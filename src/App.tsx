// Root component — immediately.run renders the default export of THIS file.
// Global CSS is imported here (not main.tsx). The pilot ELEVATED-write system
// app: reads the host theme and sets it via the gated theme:set action.
import "./index.css";
import "./App.css";
import ThemeToggle from "./components/ThemeToggle";

function App() {
  return <ThemeToggle />;
}

export default App;
