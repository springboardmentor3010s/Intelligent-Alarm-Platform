/**
 * Shared theme state. Single source for reading/applying the Light/Dark theme,
 * so every control (sidebar switcher, auth toggle, Settings) stays in sync.
 * Persists to `localStorage['ck-theme']` and drives `document.documentElement
 * [data-theme]`, which the CSS token layer consumes.
 */
export const THEME_KEY = 'ck-theme';
export const THEME_EVENT = 'ck-theme-changed';

export function getTheme() {
  return (
    document.documentElement.getAttribute('data-theme') ||
    localStorage.getItem(THEME_KEY) ||
    'light'
  );
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
}

/**
 * Subscribe to theme changes from anywhere in the app or another tab.
 * Returns an unsubscribe function.
 */
export function subscribeTheme(listener) {
  const onChange = event => {
    const next = event.detail?.theme ?? (event.type === 'storage' ? event.newValue : null);
    if (next) listener(next);
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}