// R3-829 — the switcher's selection helpers read `modeSelection` (HOST_THEMING_SPEC
// §2), never the resolved `modeId` (§9.1), which is never 'system'.
import { describe, expect, it } from 'vitest';
import { activeSegment, modeReadout } from './segments';

describe('activeSegment', () => {
  it("System chosen on a dark OS is the 'system' segment, not the resolved 'dark'", () => {
    expect(activeSegment({ modeId: 'dark', modeSelection: 'system' })).toBe('system');
  });

  it('a fixed mode is its own segment', () => {
    expect(activeSegment({ modeId: 'light', modeSelection: 'light' })).toBe('light');
  });
});

describe('modeReadout', () => {
  it('System names the resolved mode in brackets', () => {
    expect(modeReadout({ modeId: 'dark', modeSelection: 'system' })).toBe('System default (dark)');
  });

  it('a fixed mode reads as its id', () => {
    expect(modeReadout({ modeId: 'light', modeSelection: 'light' })).toBe('light');
  });
});
