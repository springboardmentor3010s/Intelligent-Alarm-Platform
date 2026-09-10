import { StyleSheet } from 'react-native';

/**
 * CerebroKognit design tokens.
 * Mirrors the web design system: amber + green spectrum, cream neutrals on
 * deep-green space backgrounds. Flat colors only — no gradients, no glow.
 */
export const BRAND = {
  // Palette
  amber: '#F4A442',
  green: '#3E7C17',
  greenSoft: '#4D8A1F',
  greenDeep: '#125C13',
  cream: '#E8E1D9',
  space: '#0F1410',
  spaceDeep: '#0A0D09',

  // Primary alias
  primary: '#F4A442',
  primarySoft: '#F4A442',
  primaryDark: '#C7761A',

  // Legacy aliases (kept for compat)
  purple: '#3E7C17',
  purpleSoft: '#4D8A1F',
  deepPurple: '#125C13',
  deepPurple2: '#0F1410',

  // Surfaces / lines
  surface: '#125C13',
  surface2: '#1E6B1A',
  surface3: '#2A7D20',
  border: '#9EB285',
  borderStrong: '#92AC76',
  inputBg: '#16201A',

  // Text
  text: '#F2EFE7',
  textDim: '#A8B89D',
  textFaint: '#8C9D80',

  // Semantic
  success: '#6CBF52',
  warm: '#F4A442',
  danger: '#E05A5A',

  // Fonts
  fontDisplay: 'System',
  fontBody: 'System',
};

export const ui = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.space, padding: 24 },
  container: { flex: 1, backgroundColor: BRAND.space, padding: 20 },
  screen: { flex: 1, backgroundColor: BRAND.space },
  title: { fontSize: 26, fontWeight: '700', color: BRAND.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: BRAND.textFaint, marginTop: 6, lineHeight: 20 },
  sysLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: BRAND.textFaint, textTransform: 'uppercase' },
  label: { fontSize: 13, fontWeight: '600', color: BRAND.textDim, marginBottom: 6 },
  card: {
    backgroundColor: BRAND.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 18,
    marginBottom: 14,
  },
  input: {
    backgroundColor: BRAND.inputBg,
    borderWidth: 1,
    borderColor: BRAND.borderStrong,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: BRAND.text,
    width: '100%',
  },
  inputPlaceholder: BRAND.textFaint,
  btnPrimary: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#0B0D0A', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
  btnGhost: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.borderStrong,
    backgroundColor: 'transparent',
  },
  btnGhostText: { color: BRAND.text, fontWeight: '600', fontSize: 15 },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: BRAND.border, marginVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
});

export const SHADOWS = {
  card: { elevation: 3, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  orangeGlow: { elevation: 3, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
};

export default { BRAND, ui, SHADOWS };