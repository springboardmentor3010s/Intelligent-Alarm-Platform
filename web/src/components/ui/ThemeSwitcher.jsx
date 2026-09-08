import React, { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from './Icons';
import { getTheme, setTheme, subscribeTheme } from '../../theme';

/**
 * Compact Light/Dark segmented control. Global — lives in the sidebar so it is
 * available on every authenticated page. Keeps every theme control in sync via
 * the shared theme helper (data-theme + localStorage['ck-theme']).
 */
export default function ThemeSwitcher() {
  const [theme, setThemeState] = useState(getTheme);

  useEffect(() => subscribeTheme(setThemeState), []);

  const apply = next => {
    setThemeState(next);
    setTheme(next);
  };

  const lightActive = theme === 'light';
  const darkActive = theme === 'dark';

  return (
    <div className="sidebar-theme">
      <span className="sidebar-theme__label">Appearance</span>
      <div className="segmented segmented--theme" role="radiogroup" aria-label="Appearance theme">
        <button
          type="button"
          role="radio"
          aria-checked={lightActive}
          aria-label="Use Light theme"
          title="Use Light theme"
          className={lightActive ? 'is-active' : ''}
          onClick={() => apply('light')}
        >
          <SunIcon size={15} />
          <span>Light</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={darkActive}
          aria-label="Use Dark theme"
          title="Use Dark theme"
          className={darkActive ? 'is-active' : ''}
          onClick={() => apply('dark')}
        >
          <MoonIcon size={15} />
          <span>Dark</span>
        </button>
      </div>
    </div>
  );
}