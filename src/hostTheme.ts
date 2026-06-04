// Set the host UI theme — the elevated `theme:set` action (UI_AS_APPS_SPEC §8.5).
//
// This is a LOCAL copy of the SDK's `setHostTheme` (added in the SDK source but
// not yet on npm). It calls the same gated path the SDK wraps: the sandbox
// bundler's message bus `protocolRequest('theme', 'set', …)`. Switch to
// `import { setHostTheme } from '@immediately-run/sdk/theme'` once the SDK is
// republished. Reading the host theme uses the published `useHostTheme`.
//
// The host gate (§8.4) rejects this unless the calling iframe's grant holds
// `theme:set`, returning a `{ ok:false, code:'forbidden' }` envelope — we throw
// an Error carrying that `.code` so the UI can fall back to "preview only".

import { useEffect, useState } from "react";

export type HostTheme = "light" | "dark";

/* eslint-disable @typescript-eslint/no-explicit-any */
function bundler(): any | null {
  try {
    // @ts-expect-error - `module` is injected by the sandbox runtime
    return module?.evaluation?.module?.bundler ?? null;
  } catch {
    return null;
  }
}

// Reading the host theme: the published SDK 0.1.5 has no `theme` export, so we
// read the same bundler theme service the SDK's `useHostTheme` wraps. Baseline
// `theme:read` — every app may read it.
export function getHostTheme(): HostTheme {
  const t = bundler()?.theme?.getTheme?.();
  return t === "light" ? "light" : "dark";
}

/** React hook: the current host theme, re-rendering on host re-push. */
export function useHostTheme(): HostTheme {
  const [theme, setTheme] = useState<HostTheme>(getHostTheme);
  useEffect(() => {
    const svc = bundler()?.theme;
    if (!svc?.onChange) return;
    const d = svc.onChange((t: string) => setTheme(t === "light" ? "light" : "dark"));
    return () => d?.dispose?.();
  }, []);
  return theme;
}

export async function setHostTheme(theme: HostTheme): Promise<void> {
  let bus: any;
  try {
    // @ts-expect-error - `module` is injected by the sandbox runtime
    bus = module?.evaluation?.module?.bundler?.messageBus;
  } catch {
    bus = undefined;
  }
  if (!bus?.protocolRequest) throw Object.assign(new Error("not in sandbox"), { code: "unknown" });

  const res = (await bus.protocolRequest("theme", "set", [{ theme }])) as
    | { ok: true; data?: unknown }
    | { ok: false; code?: string; message?: string }
    | undefined;
  if (!res || res.ok !== true) {
    const err = new Error(res?.message ?? "setHostTheme failed") as Error & {
      code?: string;
    };
    err.code = (res && "code" in res ? res.code : undefined) ?? "unknown";
    throw err;
  }
}
