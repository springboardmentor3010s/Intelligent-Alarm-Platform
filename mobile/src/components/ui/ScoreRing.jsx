import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Circular habit-score gauge. Violet ring on a tonal surface; the number is
 * mono with tabular digits so it never jitters while updating.
 */
export default function ScoreRing({ score, size = 88, label = 'Score' }) {
  const { colors } = useTheme();
  const value = Number(score) || 0;
  const inner = size - 16;
  const numSize = Math.round(size * 0.34);
  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: colors.violet,
          backgroundColor: colors.violetSoft,
        },
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: colors.surface,
            borderColor: colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.num, { fontSize: numSize, color: colors.text }]}>{value}</Text>
        <Text style={[styles.cap, { color: colors.textMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  inner: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  num: { fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  cap: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
});