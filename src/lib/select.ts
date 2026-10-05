// R3-847 — the ONE wrapper around `setHostThemeSelection`.
//
// Every selection click awaits it and catches: a refused `theme:set` (unknown
// theme, unknown mode) becomes a typed `{ ok: false, reason }` the switcher
// renders inline — never an unhandled rejection that lets the region's error
// boundary replace the whole widget and strand the default theme
// (HOST_THEMING_SPEC §6: no gate may leave the user trapped).
import { setHostThemeSelection } from '@immediately-run/sdk';

/** Select a theme (and mode). Resolves `{ ok: true }` when the host accepted
 *  it — the applied selection arrives through the `useHostThemeSelection` push,
 *  not through this result — or `{ ok: false, reason }` with the host's
 *  refusal reason. Never throws, never rejects. */
export async function selectTheme(
  themeKey: string,
  mode: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await setHostThemeSelection({ theme: themeKey, mode });
    return { ok: true };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, reason: err?.message ?? err?.code ?? 'the host refused the selection' };
  }
}
