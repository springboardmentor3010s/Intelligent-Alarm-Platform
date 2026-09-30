// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import { StyleSheet } from 'react-native';
import { fonts } from './fonts';

/**
 * CerebroKognit design tokens (React Native mirror of the web system).
 * The single source of truth is `web/src/index.css`. Every screen must read
 * colors from the active theme via `useTheme()` — never hard-code hex values.
 */

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

const base = { fonts, radii, spacing };

/* Light: porcelain surfaces on #f8fafc, violet/mint brand, semantic accents. */
const light = {
  ...base,
  bg: '#F8FAFC',
  bgSoft: '#F1F5F9',
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  surface3: '#E2E8F0',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  borderFocus: 'rgba(104,68,253,0.5)',
  text: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  violet: '#6844FD',
  violetDark: '#4E28E0',
  violetLight: '#58F6CA',
  violetSoft: 'rgba(104,68,253,0.08)',
  violetGlow: 'rgba(104,68,253,0.22)',
  rose: '#EF4444',
  roseDark: '#DC2626',
  roseSoft: 'rgba(239,68,68,0.12)',
  emerald: '#10B981',
  emeraldDark: '#059669',
  emeraldSoft: 'rgba(16,185,129,0.14)',
  tintBand: '#EEF1FF',
  tintSection: '#EEF2FA',
  tintBandfade: 'rgba(238,241,255,0)',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
};

/* Dark: obsidian slate, translucent surfaces, violet-glow focus. */
const dark = {
  ...base,
  bg: '#111826',
  bgSoft: '#182133',
  surface: 'rgba(31,42,62,0.8)',
  surface2: 'rgba(49,64,90,0.5)',
  surface3: 'rgba(64,82,112,0.45)',
  border: 'rgba(255,255,255,0.1)',
  borderStrong: 'rgba(255,255,255,0.16)',
  borderFocus: 'rgba(104,68,253,0.6)',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textFaint: '#64748B',
  violet: '#6844FD',
  violetDark: '#4E28E0',
  violetLight: '#58F6CA',
  violetSoft: 'rgba(104,68,253,0.18)',
  violetGlow: 'rgba(88,246,202,0.22)',
  rose: '#EF4444',
  roseDark: '#DC2626',
  roseSoft: 'rgba(239,68,68,0.16)',
  emerald: '#34D399',
  emeraldDark: '#10B981',
  emeraldSoft: 'rgba(52,211,153,0.16)',
  tintBand: '#1C2136',
  tintSection: '#1A2032',
  tintBandfade: 'rgba(28,33,54,0)',
  tabBar: '#182133',
  tabBarBorder: 'rgba(255,255,255,0.08)',
};

export const THEMES = { light, dark };

/**
 * Shared style primitives built per theme so components can re-theme without
 * duplicating layout rules. Prefer `useUi()` from the theme context.
 */
export function makeUi(t) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg, padding: 24 },
    card: {
      backgroundColor: t.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: t.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    input: {
      backgroundColor: t.surface2,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: radii.md,
      padding: 14,
      fontSize: 15,
      color: t.text,
      width: '100%',
    },
    inputPlaceholder: t.textFaint,
    btnPrimary: {
      backgroundColor: t.violet,
      paddingVertical: 16,
      borderRadius: radii.md,
      alignItems: 'center',
    },
    btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
    btnGhost: {
      paddingVertical: 14,
      borderRadius: radii.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: 'transparent',
    },
    btnGhostText: { color: t.text, fontWeight: '600', fontSize: 15 },
  });
}

export default { THEMES, makeUi };