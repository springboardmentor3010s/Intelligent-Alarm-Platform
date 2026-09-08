import React, { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from './icons';
import { getTheme, setTheme, subscribeTheme } from '../../theme';

/**
 * Light/dark theme toggle for the auth screens. Persists to localStorage
 * (`ck-theme`) and drives `document.documentElement[data-theme]`, which the CSS
 * token layer consumes. Stays in sync with the sidebar theme switcher via the
 * shared theme helper.
 */
export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme);

  useEffect(() => subscribeTheme(setThemeState), []);

  const isDark = theme === 'dark';

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}