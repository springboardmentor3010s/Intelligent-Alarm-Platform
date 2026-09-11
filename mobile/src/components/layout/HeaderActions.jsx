import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Right-side header actions for the Main shell: instant Light/Dark toggle plus
 * a shortcut into Settings. Icon buttons are circular so they inherit the
 * rounded brand language instead of boxy taps.
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
          { backgroundColor: colors.violetSoft, borderColor: colors.violetGlow },
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        hitSlop={6}
      >
        <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.violet} />
      </Pressable>
      <Pressable
        onPress={() => navigation.navigate('Settings')}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.violetSoft, borderColor: colors.violetGlow },
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={6}
      >
        <Ionicons name="settings-outline" size={18} color={colors.violet} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 12 },
  btn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});