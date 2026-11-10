import { useState, useEffect } from "react";
import { AppRouter } from "./AppRouter";

function App() {
  const [isDark, setIsDark] = useState<boolean>(
    () => localStorage.getItem("theme") === "dark",
  );

  useEffect(() => {
    const theme = isDark ? "dark" : "light";
    localStorage.setItem("theme", theme);
    document.documentElement.dataset.theme = theme; // drives the `dark:` variant in index.css
  }, [isDark]);

  return (
    <>
      <AppRouter darkTheme={isDark} onThemeToggle={() => setIsDark(!isDark)} />
    </>
  );
}

export default App;
