// R3-829 review round 1 (1-A-1) — the switcher fed by the REAL SDK parse, not a
// hand-typed selection. The original bug stayed green because a mock handed the
// switcher `modeId: 'system'`, which no host sends (§9.1). Here the SDK is not
// mocked: the SDK's own test double (`createMockHost`) installs the host
// transport and delivers wire-shaped `theme` / `theme-catalog` pushes, and
// the SDK's own parse produces the selection the switcher reads.
import { act, cleanup, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createMockHost } from '@immediately-run/sdk/testing';

type Msg = { type: string } & Record<string, unknown>;
const host = createMockHost();
const hostPush = (msg: Msg) => act(() => host.emit(msg));

beforeAll(() => host.install());
afterAll(() => host.uninstall());

afterEach(cleanup);

import Switcher from './Switcher';

const pushCatalog = () =>
  hostPush({
    type: 'theme-catalog',
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
  });

const checked = (container: HTMLElement) =>
  [...container.querySelectorAll('.tt__opt[aria-checked="true"]')].map((b) => b.textContent);

describe('R3-829 — the selection as the SDK parses a host push', () => {
  it('a push with modeSelection "system" checks System and reads the resolved mode', () => {
    const { container } = render(<Switcher />);
    pushCatalog();
    hostPush({ type: 'theme', theme: 'dark', themeKey: 'immediately-run-default', modeId: 'dark', modeSelection: 'system' });
    expect(checked(container)).toEqual(['System']);
    expect(container.querySelector('.tt__current-mode')?.textContent).toBe(' · System default (dark)');
  });

  it('an old host (no modeSelection) falls back to modeId: the fixed mode is checked', () => {
    const { container } = render(<Switcher />);
    pushCatalog();
    hostPush({ type: 'theme', theme: 'light', themeKey: 'immediately-run-default', modeId: 'light' });
    expect(checked(container)).toEqual(['light']);
    expect(container.querySelector('.tt__current-mode')?.textContent).toBe(' · light');
  });
});
