import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Connect row used in the Profile tab's Connect section. Opens `url` through
 * the system (mail client for mailto, browser for web links).
 */
export default function ConnectRow({ icon, label, sublabel, url, accessibilityLabel }) {
  const { colors } = useTheme();
  const open = () => {
    Linking.openURL(url).catch(() => {});
  };
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel || label}
    >
      <View style={[styles.iconTile, { backgroundColor: colors.violetSoft }]}>
        <Ionicons name={icon} size={19} color={colors.violet} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {sublabel ? <Text style={[styles.sub, { color: colors.textMuted }]}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="open-outline" size={16} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  iconTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  text: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
});