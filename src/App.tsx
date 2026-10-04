// Root component — immediately.run renders the default export of THIS file.
// The theme switcher (R3-501 · HOST_THEMING_SPEC §8.2): the `widget.theme` app
// upgraded in place from the two-state toggle.
//
// R3-834: the switcher's polarity FOLLOWS THE HOST. Apps receive only the
// host's polarity (§9.1), never its token values, so the app's own palette is
// neutral and `html[data-theme]` is set from `useHostTheme()` — never from
// `prefers-color-scheme`, which is the OS setting and not the host's.
import { useEffect } from "react";
import { useHostTheme } from "@immediately-run/sdk";
import "./index.css";
import "./App.css";
import Switcher from "./components/Switcher";

function App() {
  const theme = useHostTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return <Switcher />;
}

export default App;
