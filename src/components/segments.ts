// R3-829 — which mode segment is selected, and what the readout says.
//
// `modeId` is the RESOLVED mode (HOST_THEMING_SPEC §9.1): with System chosen it
// is `light` or `dark`, never `system`. The selection is `modeSelection` (§2's
// name for the axis: a mode id, or the literal `system`). Comparing `modeId`
// with "system" could therefore never light the System segment; every decision
// about the selection reads `modeSelection` instead.

/** The two fields of `HostThemeSelection` these helpers read. */
export interface ModeSelectionRef {
  modeId: string;
  modeSelection: string;
}

/** The checked segment: `'system'` or a mode id of the active theme. */
export function activeSegment(sel: ModeSelectionRef): string {
  return sel.modeSelection;
}

/** The mode half of the "Current theme" readout. System names the resolved
 *  mode too, so what is on screen stays visible: `System default (dark)`. */
export function modeReadout(sel: ModeSelectionRef): string {
  return sel.modeSelection === "system" ? `System default (${sel.modeId})` : sel.modeSelection;
}
