// R3-834 — the switcher's polarity follows the host (HOST_THEMING_SPEC §9.1):
// `useHostTheme()` → `html[data-theme]`, never `prefers-color-scheme` (the OS
// setting, not the host's), and the mode control is one line, always.
import { readFileSync } from 'node:fs';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The SDK boundary: `useHostTheme` is controllable per-case; everything the
// Switcher imports beside it resolves to inert no-ops (its own behaviour is
// not this test's axis).
const held = { theme: 'light' as 'light' | 'dark' };
vi.mock('@immediately-run/sdk', () => ({
  useHostTheme: () => held.theme,
  useHostThemeSelection: () => ({ themeKey: 'immediately-run-default', modeId: 'system' }),
  useThemeCatalog: () => ({ themes: [] }),
  setHostThemeSelection: () => {},
  addThemeSource: async () => {
    throw new Error('no host transport');
  },
  removeThemeSource: () => {},
  invokeTask: async () => {
    throw new Error('no host transport');
  },
}));

import App from './App';

afterEach(cleanup);

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
    expect(seg).not.toMatch(/flex-\s*wrap:\s*wrap/);
    expect(seg).toMatch(/display:\s*grid/);
    expect(seg).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(0,\s*1fr\)\)/);
  });

  it('no rule anywhere reintroduces the wrap directive', () => {
    expect(css).not.toMatch(/flex-\s*wrap:\s*wrap/);
  });
});
