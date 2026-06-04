// The theme toggle (UI_AS_APPS_SPEC §5.4 / §8.5; design brief 06). The smallest
// system app and the designated pilot for the whole capability pipeline: it
// READS the host theme (`theme:read`, baseline) and SETS it (`theme:set`,
// elevated). A segmented light/dark control reflecting the current host theme;
// it updates optimistically, then confirms from the host's re-push (the loop
// closes via `theme:read`). If this build runs without `theme:set` the control
// degrades to a disabled "preview only" state — never a hard error.
import { useState } from "react";
import { Sun, Moon } from "lucide-react";
// Both read (useHostTheme) and write (setHostTheme) are local helpers reaching
// the sandbox bundler directly: the published SDK 0.1.5 ships neither a `theme`
// export nor `setHostTheme`. Switch to the SDK once it's republished.
import { useHostTheme, setHostTheme, type HostTheme } from "../hostTheme";

const OPTIONS: Array<{ value: HostTheme; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

function ThemeToggle() {
  const hostTheme = useHostTheme();
  // Optimistic selection while the host confirms via re-push. Once the host's
  // re-push makes `hostTheme` match, `pending` is ignored (derived, no effect).
  const [pending, setPending] = useState<HostTheme | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const current: HostTheme =
    pending && pending !== hostTheme ? pending : hostTheme;

  const choose = async (value: HostTheme) => {
    if (forbidden || value === current) return;
    setPending(value);
    try {
      await setHostTheme(value);
      // Success: the host re-pushes the new theme; the effect above clears
      // `pending` when `useHostTheme` catches up.
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "forbidden") setForbidden(true);
      setPending(null); // revert the optimistic choice
    }
  };

  return (
    <section className="tt" aria-label="Host theme">
      <div className="tt__seg" role="radiogroup" aria-label="Host theme">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`tt__opt${active ? " is-active" : ""}`}
              disabled={forbidden}
              onClick={() => choose(value)}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {forbidden && (
        <p className="tt__note">
          Preview only — this copy can’t change the host theme.
        </p>
      )}
    </section>
  );
}

export default ThemeToggle;
