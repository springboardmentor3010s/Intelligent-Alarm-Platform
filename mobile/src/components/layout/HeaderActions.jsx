import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Right-side header actions for the Main shell: instant Light/Dark toggle plus
 * a shortcut into Settings. Both are uniform 40x40 icon chips (rounded-xl, 12px)
 * on a neutral translucent surface so the actions read as one family instead of
 * competing translucent circles over the gear icon.
 */
export default function HeaderActions({ navigation }) {
  const { colors, resolved, setMode } = useTheme();
  const isDark = resolved === 'dark';

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setMode(isDark ? 'light' : 'dark')}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.surface2, borderColor: colors.borderStrong },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        hitSlop={6}
      >
        <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.violet} />
      </Pressable>
      <Pressable
        onPress={() => navigation.navigate('Settings')}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.surface2, borderColor: colors.borderStrong },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={6}
      >
        <Ionicons name="settings-outline" size={20} color={colors.violet} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});