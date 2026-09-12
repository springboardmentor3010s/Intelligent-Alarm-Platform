import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Circular habit-score gauge with a color-coded accent. The track is a recessed
 * neutral ring so the accent arc reads with contrast; the tone (violet family)
 * follows the brand accent. Kept as a pure circle: the score
 * and label only, so nothing collides with the gauge line. Backwards
 * compatible: score/label usage elsewhere is unchanged.
 */
export default function ScoreRing({ score, size = 88, label = 'Score', tone = 'violet' }) {
  const { colors } = useTheme();
  const value = Number(score) || 0;
  const inner = size - 18;
  const numSize = Math.round(size * 0.32);
  const accent = colors[tone] || tone;

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 5,
          borderColor: accent,
          backgroundColor: colors.borderStrong,
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