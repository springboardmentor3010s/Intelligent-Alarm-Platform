// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Mono micro-label used above screen headers, mirroring the web `sys-label`.
 * Uppercase, tracked-out, jet-black mono. Tone defaults to the brand violet;
 * pass e.g. `violet`/`mint`/`rose` for status flavors.
 */
export default function SysLabel({ icon, tone = 'violet', children, style }) {
  const { colors } = useTheme();
  const color = colors[tone] || tone;
  return (
    <View style={[styles.row, style]}>
      {icon ? <Ionicons name={icon} size={12} color={color} style={styles.icon} /> : null}
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 6 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
});