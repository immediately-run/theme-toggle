// The theme switcher (R3-501 · HOST_THEMING_SPEC §8.2) — the `widget.theme` app
// upgraded in place from the two-state toggle. It composes the R3-500 SDK
// surface over the widened wire:
//
//   - current selection (`useHostThemeSelection`);
//   - the theme list from the `theme-catalog` channel (`useThemeCatalog`);
//   - the mode list of the selected theme;
//   - label-collision disambiguation ("Nord (repo)");
//   - **Add theme** → invokes the `open-bundle` task with `kinds: ["theme"]` →
//     `addThemeSource(location)` with SYNCHRONOUS inline adoption feedback
//     (a rejected pick surfaces in the switcher, never another surface);
//   - refresh (re-push of the catalogue follows the service);
//   - remove.
//
// The host gate rejects anything this frame may not do (`forbidden` for a
// fork without `theme:set`/`theme:sources`); this UI degrades to a read-only
// "preview" view rather than erroring.
import { useCallback, useState } from "react";
import { Check, Moon, Plus, RefreshCw, Sun, Trash2, Monitor } from "lucide-react";
import {
  useHostThemeSelection,
  useThemeCatalog,
  addThemeSource,
  removeThemeSource,
  invokeTask,
  type ThemeBundleLocation,
} from "@immediately-run/sdk";
import { selectTheme } from "../lib/select";
import { modeFor } from "../lib/modeFor";

/** The `open-bundle` task result (OPEN_BUNDLE_SPEC §2): a picked location. */
interface OpenBundleResult {
  location: ThemeBundleLocation;
}

type AddState =
  | { status: "idle" }
  | { status: "adding" }
  | { status: "error"; reason: string }
  | { status: "adopted"; themeKey: string };

function Switcher() {
  const { themeKey, modeId } = useHostThemeSelection();
  const catalog = useThemeCatalog();
  const [addState, setAddState] = useState<AddState>({ status: "idle" });
  // R3-847 — a refused selection surfaces HERE, inline, and the switcher (and
  // the default row) stay clickable. `pendingKey` is the in-flight selection
  // (`theme|mode`): while one runs, the clicked control is `aria-busy` and
  // repeat clicks are ignored (R-IX-2); the applied selection arrives through
  // the `useHostThemeSelection` push, never as local state.
  const [selectError, setSelectError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // The current theme entry (may be the default — always in the catalogue).
  const currentEntry = catalog.themes.find((t) => t.themeKey === themeKey) ?? null;

  // Mode labels come from the catalogue (host-approved, bounded); the fixed
  // "System default" is always offered.
  const currentModes = currentEntry?.modes ?? [];
  // The tab stop derived ONCE (APG radio group: the checked radio, else the
  // first): a modeId matching no option must not drop the whole group out of
  // the tab order (R3-834 review round 2).
  const tabStopMode =
    modeId === "system" || currentModes.some((m) => m.id === modeId) ? modeId : "system";

  /** One selection, caught: a refusal becomes an inline note, never a
   *  region-killing unhandled rejection (R3-847). */
  const select = useCallback(
    async (theme: string, mode: string) => {
      const key = `${theme}|${mode}`;
      if (pendingKey) return;
      setSelectError(null);
      setPendingKey(key);
      const r = await selectTheme(theme, mode);
      setPendingKey(null);
      if (!r.ok) setSelectError(`That theme isn't available right now. ${r.reason}`);
    },
    [pendingKey],
  );

  /** Invoke the open-bundle picker for a theme bundle, then adopt it. */
  const addTheme = useCallback(async () => {
    setAddState({ status: "adding" });
    try {
      const result = await invokeTask<OpenBundleResult>("open-bundle", {
        kinds: ["theme"],
      });
      if (!result?.location) {
        setAddState({ status: "error", reason: "The picker returned no location." });
        return;
      }
      await addThemeSource(result.location);
      // Synchronous, inline feedback: the service loads + gates + registers
      // BEFORE returning, so a rejection surfaces here, in the switcher. The
      // catalogue channel re-push will surface the new theme in the list.
      setAddState({ status: "adopted", themeKey: "" });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setAddState({
        status: "error",
        reason: err?.message ?? (err?.code === "cancelled" ? "Add cancelled." : "Could not add that theme."),
      });
    } finally {
      // Keep the success/error visible briefly, then settle.
      window.setTimeout(() => setAddState((s) => (s.status === "adopted" || s.status === "error" ? { status: "idle" } : s)), 2600);
    }
  }, []);

  /** Disambiguate a label collision: "Nord" from two sources → "Nord (repo)". */
  const disambiguated = useCallback((entry: (typeof catalog.themes)[number]): string => {
    const sameLabel = catalog.themes.filter((t) => t.label === entry.label);
    if (sameLabel.length <= 1) return entry.label;
    // The baseline catalogue carries no source identities; the label is all a
    // baseline reader has. When labels collide we can't name the source (the
    // projection withholds it), so fall back to the key's tail.
    const tail = entry.themeKey.split("|").pop() ?? "";
    return `${entry.label} (${tail})`;
  }, [catalog]);

  return (
    <section className="tt" aria-label="Host theme">
      <div className="tt__current">
        <span className="tt__current-label">Current theme</span>
        <span className="tt__current-value">
          {/* R3-847: never a raw themeKey — an entry missing from the
              catalogue reads "Unavailable theme". */}
          {currentEntry ? disambiguated(currentEntry) : "Unavailable theme"}
          <span className="tt__current-mode">
            {modeId === "system" ? " · System default" : ` · ${modeId}`}
          </span>
        </span>
      </div>

      {/* Mode list of the selected theme (fixed host labels; the catalogue's
          mode ids are the resolved ones). R3-834 review round 1: the APG
          radiogroup pattern is implemented for real — a roving tabindex
          (the checked option is the tab stop) and arrow keys move focus and
          select, exactly what role="radiogroup" announces. */}
      <div
        className="tt__seg"
        role="radiogroup"
        aria-label="Theme mode"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const group = e.currentTarget;
          const opts = [...group.querySelectorAll<HTMLElement>(".tt__opt:not(:disabled)")];
          if (opts.length < 2) return;
          const at = opts.indexOf(document.activeElement as HTMLElement);
          const dir = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
          const next = opts[(at + dir + opts.length) % opts.length];
          next.focus();
          next.click();
        }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={modeId === "system"}
          aria-busy={pendingKey === themeKey + "|system"}
          disabled={pendingKey !== null}
          tabIndex={tabStopMode === "system" ? 0 : -1}
          className={`tt__opt${modeId === "system" ? " is-active" : ""}`}
          onClick={() => void select(themeKey, "system")}
        >
          <Monitor size={15} aria-hidden="true" />
          <span>System</span>
        </button>
        {currentModes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={modeId === m.id}
            aria-busy={pendingKey === themeKey + "|" + m.id}
            disabled={pendingKey !== null}
            tabIndex={tabStopMode === m.id ? 0 : -1}
            className={`tt__opt${modeId === m.id ? " is-active" : ""}`}
            onClick={() => void select(themeKey, m.id)}
          >
            {m.polarity === "dark" ? (
              <Moon size={15} aria-hidden="true" />
            ) : (
              <Sun size={15} aria-hidden="true" />
            )}
            <span>{m.id}</span>
          </button>
        ))}
      </div>

      {/* Theme list from the catalogue channel. */}
      <div className="tt__list" role="list" aria-label="Themes">
        {/* R3-847 — §6's escape hatch, exactly once: the default row is ALWAYS
            rendered (empty catalogue, channel not arrived, refused selection —
            the default stays present and selectable), and its click is the one
            selection the host always accepts. */}
        <div
          className={`tt__theme${themeKey === "immediately-run-default" ? " is-active" : ""}`}
          role="listitem"
        >
          <button
            type="button"
            className="tt__theme-select"
            aria-busy={pendingKey === "immediately-run-default|system"}
            disabled={pendingKey !== null}
            onClick={() => void select("immediately-run-default", "system")}
          >
            {themeKey === "immediately-run-default" ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <span className="tt__theme-dot" />
            )}
            <span>immediately.run default</span>
          </button>
        </div>
        {catalog.themes
          .filter((entry) => entry.themeKey !== "immediately-run-default")
          .map((entry) => {
          const active = entry.themeKey === themeKey;
          return (
            <div key={entry.themeKey} className={`tt__theme${active ? " is-active" : ""}`} role="listitem">
              <button
                type="button"
                className="tt__theme-select"
                aria-busy={pendingKey === entry.themeKey + "|" + modeFor(modeId, currentModes, entry.modes)}
                disabled={pendingKey !== null}
                onClick={() =>
                  void select(
                    entry.themeKey,
                    // R3-847 — the user's intent, not a stale id: System
                    // stays System; a fixed mode maps by polarity
                    // (`modeFor`), so the target theme is never sent a mode
                    // it does not carry.
                    modeFor(modeId, currentModes, entry.modes),
                  )
                }
              >
                {active ? <Check size={15} aria-hidden="true" /> : <span className="tt__theme-dot" />}
                <span>{disambiguated(entry)}</span>
              </button>
              {active && <span className="tt__active-badge">active</span>}
              {entry.themeKey !== "immediately-run-default" && (
                <button
                  type="button"
                  className="tt__remove"
                  title="Remove theme"
                  aria-label={`Remove ${entry.label}`}
                  onClick={() => removeThemeSource(entry.themeKey)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
        {catalog.themes.length === 0 && (
          <p className="tt__note">No themes yet. Add one from a repository or space.</p>
        )}
      </div>

      {/* R3-847 — a refused selection's reason, inline under the control that
          caused it; the switcher stays mounted and every row stays clickable. */}
      {selectError && (
        <p role="status" className="tt__note tt__note--err">
          {selectError}
        </p>
      )}

      <div className="tt__add">
        <button
          type="button"
          className="tt__add-btn"
          disabled={addState.status === "adding"}
          onClick={addTheme}
        >
          {addState.status === "adding" ? (
            <RefreshCw size={15} aria-hidden="true" className="tt__spin" />
          ) : (
            <Plus size={15} aria-hidden="true" />
          )}
          <span>Add theme…</span>
        </button>
        {addState.status === "error" && <p role="status" className="tt__note tt__note--err">{addState.reason}</p>}
        {addState.status === "adopted" && (
          <p role="status" className="tt__note tt__note--ok">Added. Pick it from the list above.</p>
        )}
      </div>

      {/* R3-834: one sentence — the frame is 320px and the old two-sentence
          footer pushed the content past it. */}
      <p className="tt__foot">Themes are checked for contrast before they apply.</p>
    </section>
  );
}

export default Switcher;