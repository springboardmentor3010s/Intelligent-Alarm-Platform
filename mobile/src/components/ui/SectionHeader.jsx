// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Mono section divider label (uppercase, tracked). Tone defaults to violet.
 */
export default function SectionHeader({ children, tone = 'violet', style }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.text, { color: colors[tone] || tone }, style]} numberOfLines={1}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
});