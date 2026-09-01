# theme-toggle → theme-switcher

The `widget.theme` system app, upgraded **in place** from the two-state toggle to
the **theme switcher** (R3-501 · `HOST_THEMING_SPEC` §8.2). Loaded into a chrome
region by the host; not meant to be run standalone.

It is the forkable surface for appearance:

- **Current selection** — the active theme + resolved mode (`useHostThemeSelection`);
- **Theme list** from the `theme-catalog` channel (`useThemeCatalog`), with
  label-collision disambiguation ("Nord (repo)");
- **Mode list** of the selected theme (System + the theme's polarity modes);
- **Add theme** → invokes the `open-bundle` task with `kinds: ["theme"]` →
  `addThemeSource(location)`, with **synchronous inline adoption feedback** — a
  gated-out candidate surfaces here in the switcher, never another surface;
- **Refresh** (the catalogue re-pushes via the channel) and **remove**.

Requires the elevated `theme:set` + `theme:sources` + `task:invoke`
capabilities (the `widget.theme` ceiling in `defaults.ts`); a fork without them
degrades to read-only.

Built against `@immediately-run/sdk` 0.59.0 (the widened theme surface).
