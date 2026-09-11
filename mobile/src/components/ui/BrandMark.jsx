import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Brand lockup: violet brand tile + wordmark. Mirrors the web `.brand-logo`.
 * `variant="solid"` renders a filled indigo-violet tile (brand CTA); `soft`
 * renders a violet-soft tint tile with a violet glyph (header/hero use).
 */
function BrandMark({ icon = 'flash', size = 44, variant = 'soft' }) {
  const { colors } = useTheme();
  const radius = Math.round(size / 2.9);
  const iconSize = Math.round(size * 0.5);
  const solid = variant === 'solid';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: solid ? colors.violet : colors.violetSoft,
          borderWidth: solid ? 0 : 1,
          borderColor: colors.violetGlow,
        },
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={solid ? '#FFFFFF' : colors.violet} />
    </View>
  );
}

export default BrandMark;

export function BrandLockup({ icon = 'flash', wordmark = 'CerebroKognit', variant = 'soft', size = 40, wordmarkSize = 18, align = 'row' }) {
  const { colors } = useTheme();
  const horizontal = align === 'row';
  return (
    <View style={[styles.lockup, horizontal ? { flexDirection: 'row' } : { flexDirection: 'column' }]}>
      <BrandMark icon={icon} size={size} variant={variant} />
      <Text
        style={[
          styles.wordmark,
          {
            color: colors.text,
            fontSize: wordmarkSize,
            lineHeight: wordmarkSize + 4,
            marginLeft: horizontal ? 10 : 0,
            marginTop: horizontal ? 0 : 8,
          },
        ]}
      >
        {wordmark}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  lockup: { alignItems: 'center' },
  wordmark: { fontWeight: '800', letterSpacing: -0.4 },
});