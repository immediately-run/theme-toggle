// R3-847 — the pure mode mapper: picking a theme from the list keeps the
// user's intent instead of sending a mode id the target theme may not carry
// (the second route to a refused `theme:set`). Inputs shaped from the real
// catalogue: the default's light/dark, Danube Dusk's light/dark (its committed
// theme.json), and a one-mode `night` theme.
import { describe, expect, it } from 'vitest';
import { modeFor, type ThemeModeRef } from './modeFor';

const lightDark: ThemeModeRef[] = [
  { id: 'light', polarity: 'light' },
  { id: 'dark', polarity: 'dark' },
];
const nightOnly: ThemeModeRef[] = [{ id: 'night', polarity: 'dark' }];

describe('modeFor (R3-847)', () => {
  it('system maps to system', () => {
    expect(modeFor('system', lightDark, lightDark)).toBe('system');
  });

  it('dark onto Danube Dusk maps to dark', () => {
    expect(modeFor('dark', lightDark, lightDark)).toBe('dark');
  });

  it('dark onto the one-mode night theme maps to night', () => {
    expect(modeFor('dark', lightDark, nightOnly)).toBe('night');
  });

  it('light onto a dark-only theme falls back to its sole mode', () => {
    expect(modeFor('light', lightDark, nightOnly)).toBe('night');
  });

  it('an unknown current mode falls back to the target’s first mode, then system', () => {
    expect(modeFor('dusk', lightDark, lightDark)).toBe('light');
    expect(modeFor('dusk', lightDark, [])).toBe('system');
  });
});
