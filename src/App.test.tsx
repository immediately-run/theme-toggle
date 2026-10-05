// R3-834 — the switcher's polarity follows the host (HOST_THEMING_SPEC §9.1):
// `useHostTheme()` → `html[data-theme]`, never `prefers-color-scheme` (the OS
// setting, not the host's), and the mode control is one line, always.
import { readFileSync } from 'node:fs';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The SDK boundary: `useHostTheme`, the catalog and the selection setter are
// controllable per-case; everything else the Switcher imports resolves to
// inert no-ops.
const held = {
  theme: 'light' as 'light' | 'dark',
  modeId: 'system',
  catalog: { themes: [] as { themeKey: string; label: string; modes: { id: string; polarity: 'light' | 'dark' }[] }[] },
};
const setSelection = vi.fn();
vi.mock('@immediately-run/sdk', () => ({
  useHostTheme: () => held.theme,
  useHostThemeSelection: () => ({ themeKey: 'immediately-run-default', modeId: held.modeId }),
  useThemeCatalog: () => held.catalog,
  setHostThemeSelection: (...args: unknown[]) => setSelection(...(args as [])),
  addThemeSource: async () => {
    throw new Error('no host transport');
  },
  removeThemeSource: () => {},
  invokeTask: async () => {
    throw new Error('no host transport');
  },
}));

import App from './App';

afterEach(() => {
  cleanup();
  setSelection.mockClear();
  held.modeId = 'system';
  held.catalog = { themes: [] };
});

describe('R3-834 — polarity from useHostTheme, set on <html>', () => {
  it('a light host sets html[data-theme="light"]', () => {
    held.theme = 'light';
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('flipping the host to dark — and back — updates the attribute', () => {
    held.theme = 'dark';
    const { rerender } = render(<App />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    held.theme = 'light';
    rerender(<App />);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

// The App.css guard (R3-834): the mode control can never wrap — a grid with
// minmax(0, 1fr) tracks, not a wrapping flex row (the old shape dropped
// "dark" onto a second line in the ~250px settings card).
describe('R3-834 — the mode control is one line', () => {
  // process.cwd() is the repo root under vitest; the tests' tsconfig carries
  // the node types (tsconfig.vitest.json), so the app's stays ["vite/client"].
  const css = readFileSync('src/App.css', 'utf8');
  const rule = (selector: string): string => {
    const at = css.indexOf(selector);
    expect(at).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  it('the wrap directive is gone from the segment control, which is a grid', () => {
    const seg = rule('.tt__seg');
    expect(seg).not.toMatch(/flex-\s*wrap\s*:\s*wrap/i);
    expect(seg).toMatch(/display\s*:\s*grid/i);
    expect(seg).toMatch(/grid-template-columns\s*:\s*repeat\(auto-fit,\s*minmax\(0,\s*1fr\)\)/i);
  });

  it('no rule anywhere reintroduces the wrap directive', () => {
    expect(css).not.toMatch(/flex-\s*wrap\s*:\s*wrap/i);
  });
});

// ── R3-834 review round 1 — the APG radiogroup, driven ───────────────────────
// role="radiogroup" announces arrow-key movement; the round-1 reviewers found
// none existed (the item's "keeps" premise was false). Implemented for real:
// a roving tabindex (the checked option is the tab stop) and arrows move
// focus AND select — pinned here.
describe('R3-834 — the mode control is a real radiogroup', () => {
  it('a modeId matching no option still leaves the group tabbable (the APG fallback: the first radio)', () => {
    held.catalog = {
      themes: [
        {
          themeKey: 'immediately-run-default',
          label: 'immediately.run default',
          modes: [
            { id: 'light', polarity: 'light' },
            { id: 'dark', polarity: 'dark' },
          ],
        },
      ],
    };
    // A stale mode id (the round-2 finding: the old theme's id sent to a new
    // theme) must not drop the whole group out of the tab order.
    held.modeId = 'a-stale-mode-from-another-theme';
    const { container } = render(<App />);
    const opts = [...container.querySelectorAll<HTMLElement>('.tt__opt')];
    expect(opts[0].tabIndex).toBe(0); // the first option is the tab stop
    expect(opts.slice(1).every((o) => o.tabIndex === -1)).toBe(true);
  });

  it('arrow keys move focus and select the next option (roving tabindex)', async () => {
    held.catalog = {
      themes: [
        {
          themeKey: 'immediately-run-default',
          label: 'immediately.run default',
          modes: [
            { id: 'light', polarity: 'light' },
            { id: 'dark', polarity: 'dark' },
          ],
        },
      ],
    };
    const { container } = render(<App />);
    const seg = container.querySelector('.tt__seg') as HTMLElement;
    const opts = [...seg.querySelectorAll<HTMLElement>('.tt__opt')];
    expect(opts.length).toBe(3); // System + light + dark
    // The checked option is the tab stop; the others are out of the tab order.
    expect(opts[0].tabIndex).toBe(0);
    expect(opts[1].tabIndex).toBe(-1);
    opts[0].focus();
    opts[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(opts[1]);
    expect(setSelection).toHaveBeenCalledWith({ theme: 'immediately-run-default', mode: 'light' });
    // The selection follows: the newly selected option becomes the tab stop.
    held.modeId = 'light';
    // (The roving tabindex is derived from the selection, so a re-render moves
    // the stop; the arrows move within whatever the current stop is.)
    opts[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(opts[0]);
    expect(setSelection).toHaveBeenLastCalledWith({ theme: 'immediately-run-default', mode: 'system' });
  });
});

// ── R3-834 review round 3 — the theme-row selection payload, driven ──────────
// The round-2 fix changed the payload (the NEW theme's first mode, never the
// old theme's id) with no test; this PR's own history had already proved that
// exact expression buggy. Pinned here, all three arms.
describe('R3-834 — the theme-row selection payload', () => {
  type Mode = { id: string; polarity: 'light' | 'dark' };
  type Entry = { themeKey: string; label: string; modes: Mode[] };
  const TWO_THEMES: { themes: Entry[] } = {
    themes: [
      {
        themeKey: 'immediately-run-default',
        label: 'immediately.run default',
        modes: [
          { id: 'light', polarity: 'light' },
          { id: 'dark', polarity: 'dark' },
        ],
      },
      {
        themeKey: 'danube-dusk',
        label: 'Danube Dusk',
        modes: [
          { id: 'light', polarity: 'light' },
          { id: 'dark', polarity: 'dark' },
        ],
      },
    ],
  };

  it('clicking a theme row maps the current polarity onto the target — never the old theme\'s id', async () => {
    held.catalog = TWO_THEMES;
    held.modeId = 'dark';
    const { container } = render(<App />);
    const row = [...container.querySelectorAll('.tt__theme-select')].find(
      (b) => (b.textContent || '').includes('Danube'),
    ) as HTMLElement;
    expect(row).toBeTruthy();
    row.click();
    // R3-847: the intent (a dark mode) maps to danube-dusk's dark-polarity
    // mode. The committed theme.json (site-main's fixture) gives Danube Dusk
    // the mode ids light/dark with Dawn/Dusk as LABELS — the catalogue
    // projects the ids.
    expect(setSelection).toHaveBeenCalledWith({ theme: 'danube-dusk', mode: 'dark' });
  });

  it('the system arm: a system modeId crossing to a theme stays system', async () => {
    held.catalog = TWO_THEMES;
    held.modeId = 'system';
    const { container } = render(<App />);
    const row = [...container.querySelectorAll('.tt__theme-select')].find(
      (b) => (b.textContent || '').includes('Danube'),
    ) as HTMLElement;
    row.click();
    expect(setSelection).toHaveBeenCalledWith({ theme: 'danube-dusk', mode: 'system' });
  });

  it('the empty-modes arm: a theme with no modes falls back to system', async () => {
    held.catalog = { themes: [...TWO_THEMES.themes, { themeKey: 'empty-theme', label: 'Empty', modes: [] as Mode[] }] };
    held.modeId = 'dark';
    const { container } = render(<App />);
    const row = [...container.querySelectorAll('.tt__theme-select')].find(
      (b) => (b.textContent || '').includes('Empty'),
    ) as HTMLElement;
    row.click();
    expect(setSelection).toHaveBeenCalledWith({ theme: 'empty-theme', mode: 'system' });
  });
});
