// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, makeUi, makeShadows } from './tokens';
import { fonts as fontsRoles } from './fonts';

export const THEME_MODES = ['dark', 'light', 'system'];

const STORAGE_KEY = 'ck-theme';

const defaultDark = {
  mode: 'dark',
  resolved: 'dark',
  isDark: true,
  colors: THEMES.dark,
  ui: makeUi(THEMES.dark),
  shadows: makeShadows(THEMES.dark, 'dark'),
  fonts: fontsRoles,
  reduceMotion: false,
  setMode: () => {},
};

const ThemeContext = createContext(defaultDark);

/**
 * Theme provider for the mobile app. Mirrors `web/src/theme.js`:
 * choice is persisted under `ck-theme`; `system` follows the OS scheme.
 * Dark is the default so the retro-positioning stays intact in all modes.
 */
export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState('dark');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const valid = stored && THEME_MODES.includes(stored);
      if (valid) setModeState(stored);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(!!enabled);
    }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(!!enabled);
    });
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  const setMode = useCallback((next) => {
    if (!THEME_MODES.includes(next)) return;
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const resolved = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo(() => {
    const colors = THEMES[resolved];
    return {
      mode,
      resolved,
      isDark: resolved === 'dark',
      colors,
      ui: makeUi(colors),
      shadows: makeShadows(colors, resolved),
      fonts: fontsRoles,
      reduceMotion,
      setMode,
    };
  }, [mode, resolved, reduceMotion, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;