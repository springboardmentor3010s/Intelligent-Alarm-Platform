import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Single-select chip row (recurrence, challenge engine, difficulty, counts).
 * Active chip fills indigo-violet with white text; inactive is a tonal surface.
 */
export default function ChipRow({ options, active, onSelect, labelTransform = 'none' }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const isActive = opt === active;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={opt}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? colors.violet : colors.surface2,
                borderColor: isActive ? colors.violet : colors.borderStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: isActive ? '#FFFFFF' : colors.textMuted,
                  textTransform: labelTransform,
                },
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  chipText: { fontSize: 13, fontWeight: '600' },
});