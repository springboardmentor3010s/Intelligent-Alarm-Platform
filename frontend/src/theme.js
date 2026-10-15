// Light is the default and the original design. Dark is an option.
const KEY = "ca_theme";

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* storage can be blocked; fall back to light */
  }
  return "light";
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

// Set the saved theme before the first paint so the page does not flash.
document.documentElement.setAttribute("data-theme", getTheme());
