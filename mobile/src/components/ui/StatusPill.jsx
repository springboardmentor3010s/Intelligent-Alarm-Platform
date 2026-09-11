import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Status pill with an LED dot. Tones: emerald (on/healthy), amber (attention),
 * cyan (syncing), rose (destructive). `reduceMotion` disables the pulse.
 */
export default function StatusPill({ label, tone = 'emerald', leadingDot = true, style }) {
  const { colors, reduceMotion } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, pulse]);

  const color = colors[tone] || tone;

  return (
    <View style={[styles.pill, { backgroundColor: colors.surface2, borderColor: colors.border }, style]}>
      {leadingDot ? (
        <Animated.View
          style={[styles.dot, { backgroundColor: color, opacity: pulse }]}
          accessibilityElementsHidden
        />
      ) : null}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
});