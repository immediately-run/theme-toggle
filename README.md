# theme-toggle

The smallest [immediately.run](https://immediately.run) system app, and the
designated **pilot for the capability pipeline** (`UI_AS_APPS_SPEC` §5.4 / §8.5,
design brief 06).

It reads the host UI theme (`theme:read`, baseline) and sets it (`theme:set`,
**elevated**) — a segmented light/dark control reflecting the current host theme.
It updates optimistically, then confirms from the host's re-push (the loop closes
via `theme:read`). A build running without `theme:set` degrades to a disabled
"preview only" state rather than erroring.

Loaded into a chrome region by the host; not meant to be run standalone.
