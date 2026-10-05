// R3-847 — the pure mode mapper for picking a theme from the list.
//
// The old click sent the CURRENT theme's first mode id (or a stale id), which
// the target theme may not carry — the second route to a refused `theme:set`
// (`unknown mode`). Picking a theme keeps the user's intent instead
// (HOST_THEMING_SPEC §9.3): "System" stays System; a fixed mode maps to the
// target theme's mode of the same polarity; if the target has none of that
// polarity, its sole mode is used.

export interface ThemeModeRef {
  id: string;
  polarity: 'light' | 'dark';
}

/** The mode the target theme should be selected with, given the current
 *  selection. Pure; never throws — an unknown current mode or an empty target
 *  falls back to the target's first mode, then to 'system'. */
export function modeFor(
  currentModeId: string,
  currentModes: readonly ThemeModeRef[],
  targetModes: readonly ThemeModeRef[],
): string {
  if (currentModeId === 'system') return 'system';
  const polarity = currentModes.find((m) => m.id === currentModeId)?.polarity;
  if (!polarity) return targetModes[0]?.id ?? 'system';
  return targetModes.find((m) => m.polarity === polarity)?.id ?? targetModes[0]?.id ?? 'system';
}
