// Root component — immediately.run renders the default export of THIS file.
// The theme switcher (R3-501 · HOST_THEMING_SPEC §8.2): the `widget.theme` app
// upgraded in place from the two-state toggle.
import "./index.css";
import "./App.css";
import Switcher from "./components/Switcher";

function App() {
  return <Switcher />;
}

export default App;