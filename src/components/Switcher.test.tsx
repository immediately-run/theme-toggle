// R3-847 — a refused selection must never kill the switcher: the SDK's
// `setHostThemeSelection` (mocked here) rejecting `invalid-params: unknown
// theme` shows the inline error, keeps the switcher mounted, and keeps the
// default theme row clickable (HOST_THEMING_SPEC §6's escape hatch).
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Mode = { id: string; polarity: 'light' | 'dark' };
type Entry = { themeKey: string; label: string; modes: Mode[] };

const held = {
  themeKey: 'repo|github:owner/themes|danube-dusk',
  modeId: 'dark' as string,
  modeSelection: 'dark' as string,
  catalog: { themes: [] as Entry[] },
};
// What the SDK mock's setHostThemeSelection does with the next call.
let nextSelection: (sel: { theme: string; mode: string }) => Promise<void> = async () => {};
const setSelection = vi.fn((...args: [{ theme: string; mode: string }]) => nextSelection(...args));

vi.mock('@immediately-run/sdk', () => ({
  useHostTheme: () => 'dark' as const,
  useHostThemeSelection: () => ({ themeKey: held.themeKey, modeId: held.modeId, modeSelection: held.modeSelection }),
  useThemeCatalog: () => held.catalog,
  setHostThemeSelection: (sel: { theme: string; mode: string }) => setSelection(sel),
  addThemeSource: async () => {},
  removeThemeSource: () => {},
  invokeTask: async () => ({}),
}));

import Switcher from './Switcher';

afterEach(() => {
  cleanup();
  setSelection.mockClear();
  held.themeKey = 'repo|github:owner/themes|danube-dusk';
  held.modeId = 'dark';
  held.modeSelection = 'dark';
  held.catalog = { themes: [] };
  nextSelection = async () => {};
});

describe('R3-847 — a refused selection stays inline', () => {
  it('an unknown-theme refusal shows the inline error, the switcher stays mounted, and the default row is still clickable', async () => {
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
    nextSelection = async () => {
      const e = new Error('invalid-params: unknown theme') as Error & { code?: string };
      e.code = 'invalid-params';
      throw e;
    };
    const { container } = render(<Switcher />);

    // The System arm is refused (the current selection names an unloaded theme).
    (container.querySelector('.tt__opt') as HTMLElement).click();
    await waitFor(() => {
      expect(container.querySelector('.tt__note--err')?.textContent).toContain("That theme isn't available right now");
    });
    // The switcher did not die: no error boundary, the section is still there.
    expect(container.querySelector('section.tt')).toBeTruthy();
    expect(container.textContent).not.toContain('Something went wrong');

    // The default row is still present and clickable, and its click is
    // answered by the host (this call resolves).
    nextSelection = async () => {};
    const defaultRow = [...container.querySelectorAll('.tt__theme-select')].find(
      (b) => (b.textContent || '').includes('immediately.run default'),
    ) as HTMLElement;
    expect(defaultRow).toBeTruthy();
    defaultRow.click();
    await waitFor(() => {
      expect(setSelection).toHaveBeenLastCalledWith({ theme: 'immediately-run-default', mode: 'system' });
    });
    await waitFor(() => {
      expect(container.querySelector('.tt__note--err')).toBeNull();
    });
  });

  it('a THEME-ROW refusal also stays inline (the item\'s named path: a stale catalogue row)', async () => {
    held.catalog = {
      themes: [
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
    nextSelection = async () => {
      const e = new Error('invalid-params: unknown theme') as Error & { code?: string };
      e.code = 'invalid-params';
      throw e;
    };
    const { container } = render(<Switcher />);
    const row = [...container.querySelectorAll('.tt__theme-select')].find(
      (b) => (b.textContent || '').includes('Danube'),
    ) as HTMLElement;
    expect(row).toBeTruthy();
    row.click();
    await waitFor(() => {
      expect(container.querySelector('.tt__note--err')?.textContent).toContain("That theme isn't available right now");
    });
    expect(container.querySelector('section.tt')).toBeTruthy();
    // A repeat click while nothing is in flight still works (the guard only
    // blocks during flight): the default row stays actionable.
    nextSelection = async () => {};
    const defaultRow = [...container.querySelectorAll('.tt__theme-select')].find(
      (b) => (b.textContent || '').includes('immediately.run default'),
    ) as HTMLElement;
    defaultRow.click();
    await waitFor(() => {
      expect(setSelection).toHaveBeenLastCalledWith({ theme: 'immediately-run-default', mode: 'system' });
    });
  });

  it('a click during flight is ignored and shows the pending state; the guard lifts when it settles', async () => {
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
    // A DEFERred host: the selection stays in flight until we let it go.
    const gate = { release: null as null | (() => void) };
    nextSelection = () =>
      new Promise<void>((resolve) => {
        gate.release = resolve;
      });
    const { container } = render(<Switcher />);

    const sysArm = container.querySelector('.tt__opt') as HTMLElement;
    sysArm.click();
    sysArm.click(); // repeat click DURING flight
    await waitFor(() => {
      expect(setSelection).toHaveBeenCalledTimes(1); // the guard ignored the repeat
    });
    expect(sysArm.getAttribute('aria-busy')).toBe('true');
    expect(sysArm.getAttribute('aria-disabled')).toBe('true');

    gate.release?.();
    await waitFor(() => {
      expect(sysArm.getAttribute('aria-busy')).toBe('false');
      expect(sysArm.getAttribute('aria-disabled')).toBe('false');
    });
    // The guard lifted: a new click goes through.
    sysArm.click();
    await waitFor(() => {
      expect(setSelection).toHaveBeenCalledTimes(2);
    });
  });

  it('with an empty catalogue the default row renders', () => {
    held.catalog = { themes: [] };
    const { container } = render(<Switcher />);
    const defaultRow = [...container.querySelectorAll('.tt__theme-select')].find(
      (b) => (b.textContent || '').includes('immediately.run default'),
    ) as HTMLElement;
    expect(defaultRow).toBeTruthy();
    defaultRow.click();
    expect(setSelection).toHaveBeenCalledWith({ theme: 'immediately-run-default', mode: 'system' });
  });

  it('the Current theme line never shows a raw themeKey', () => {
    held.catalog = { themes: [] }; // the selection names an unloaded theme
    const { container } = render(<Switcher />);
    const line = container.querySelector('.tt__current-value')?.textContent || '';
    expect(line).toContain('Unavailable theme');
    expect(line).not.toContain('danube-dusk');
    expect(line).not.toContain('repo|github');
  });
});

describe('R3-829 — the System segment follows modeSelection, not the resolved modeId', () => {
  const DEFAULT_WITH_MODES = {
    themes: [
      {
        themeKey: 'immediately-run-default',
        label: 'immediately.run default',
        modes: [
          { id: 'light', polarity: 'light' as const },
          { id: 'dark', polarity: 'dark' as const },
        ],
      },
    ],
  };

  const checked = (container: HTMLElement) =>
    [...container.querySelectorAll('.tt__opt[aria-checked="true"]')].map((b) => b.textContent);

  it('System chosen on a dark OS: System is the one checked segment and the readout names the resolved mode', () => {
    held.themeKey = 'immediately-run-default';
    held.catalog = DEFAULT_WITH_MODES;
    held.modeId = 'dark'; // §9.1: the resolved mode, never 'system'
    held.modeSelection = 'system';
    const { container } = render(<Switcher />);
    expect(checked(container)).toEqual(['System']);
    expect(container.querySelector('.tt__opt.is-active')?.textContent).toBe('System');
    expect(container.querySelector('.tt__current-mode')?.textContent).toBe(' · System default (dark)');
    // The System segment is also the radio group's tab stop.
    expect(container.querySelector('.tt__opt[tabindex="0"]')?.textContent).toBe('System');
  });

  it('a fixed mode chosen: that segment is checked and the readout names it', () => {
    held.themeKey = 'immediately-run-default';
    held.catalog = DEFAULT_WITH_MODES;
    held.modeId = 'light';
    held.modeSelection = 'light';
    const { container } = render(<Switcher />);
    expect(checked(container)).toEqual(['light']);
    expect(container.querySelector('.tt__current-mode')?.textContent).toBe(' · light');
  });
});
