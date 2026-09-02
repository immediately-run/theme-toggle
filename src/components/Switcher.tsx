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
  setHostThemeSelection,
  addThemeSource,
  removeThemeSource,
  invokeTask,
  type ThemeBundleLocation,
} from "@immediately-run/sdk";

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

  // The current theme entry (may be the default — always in the catalogue).
  const currentEntry = catalog.themes.find((t) => t.themeKey === themeKey) ?? null;

  // Mode labels come from the catalogue (host-approved, bounded); the fixed
  // "System default" is always offered.
  const currentModes = currentEntry?.modes ?? [];

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
          {currentEntry ? disambiguated(currentEntry) : themeKey}
          <span className="tt__current-mode">
            {modeId === "system" ? " · System default" : ` · ${modeId}`}
          </span>
        </span>
      </div>

      {/* Mode list of the selected theme (fixed host labels; the catalogue's
          mode ids are the resolved ones). */}
      <div className="tt__seg" role="radiogroup" aria-label="Theme mode">
        <button
          type="button"
          role="radio"
          aria-checked={modeId === "system"}
          className={`tt__opt${modeId === "system" ? " is-active" : ""}`}
          onClick={() => setHostThemeSelection({ theme: themeKey, mode: "system" })}
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
            className={`tt__opt${modeId === m.id ? " is-active" : ""}`}
            onClick={() => setHostThemeSelection({ theme: themeKey, mode: m.id })}
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
        {catalog.themes.map((entry) => {
          const active = entry.themeKey === themeKey;
          return (
            <div key={entry.themeKey} className={`tt__theme${active ? " is-active" : ""}`} role="listitem">
              <button
                type="button"
                className="tt__theme-select"
                onClick={() =>
                  setHostThemeSelection({
                    theme: entry.themeKey,
                    mode: modeId === "system" ? "system" : currentModes[0]?.id ?? "system",
                  })
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
        {addState.status === "error" && <p className="tt__note tt__note--err">{addState.reason}</p>}
        {addState.status === "adopted" && (
          <p className="tt__note tt__note--ok">Added. Pick it from the list above.</p>
        )}
      </div>

      <p className="tt__foot">
        Themes are fetched, gated, and stored by the host. A theme with an
        accessibility gate failure is refused here, inline.
      </p>
    </section>
  );
}

export default Switcher;