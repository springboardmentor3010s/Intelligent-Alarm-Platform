import { useState } from "react";
import { applyTheme, getTheme } from "../theme";

function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(getTheme());

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      className={`icon-button theme-toggle ${className}`}
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

export default ThemeToggle;
