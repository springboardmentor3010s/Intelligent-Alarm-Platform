import { StyleSheet } from 'react-native';

/**
 * CerebroKognit retro-futuristic design tokens.
 * Mirrors the web design system: brand orange, purple spectrum, deep space backgrounds.
 */
export const BRAND = {
  // Palette
  primary: '#F25912',
  primarySoft: '#FF8A4D',
  primaryDark: '#D84A0E',
  purple: '#5C3E94',
  purpleSoft: '#8B6BC6',
  deepPurple: '#412B6B',
  deepPurple2: '#2C1F42',
  space: '#211832',
  spaceDeep: '#1A1129',

  // Surfaces / lines
  surface: '#2C1F42',
  surface2: '#382A52',
  surface3: '#412B6B',
  border: '#3D2A5E',
  borderStrong: '#4A3569',
  inputBg: '#32244C',

  // Text
  text: '#F7F3FC',
  textDim: '#C3B8DA',
  textFaint: '#8E81A8',

  // Semantic
  success: '#42D6A4',
  warm: '#F5C75A',
  danger: '#F06B82',

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
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
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
  orangeGlow: { elevation: 6, shadowColor: BRAND.primary, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
};

export default { BRAND, ui, SHADOWS };