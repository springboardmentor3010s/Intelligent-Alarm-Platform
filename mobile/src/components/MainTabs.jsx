import React, { useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import HomeTab from '../screens/tabs/HomeTab';
import AlarmsTab from '../screens/tabs/AlarmsTab';
import InsightsTab from '../screens/tabs/InsightsTab';
import ProfileTab from '../screens/tabs/ProfileTab';

const TABS = [
  { key: 'HOME', label: 'Home', icon: 'rocket-outline', iconActive: 'rocket' },
  { key: 'ALARMS', label: 'Alarms', icon: 'alarm-outline', iconActive: 'alarm' },
  { key: 'INSIGHTS', label: 'Insights', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { key: 'PROFILE', label: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

const CONTENT = {
  HOME: HomeTab,
  ALARMS: AlarmsTab,
  INSIGHTS: InsightsTab,
  PROFILE: ProfileTab,
};

/**
 * Tabbed main shell, custom bottom navigation (Home/Alarms/Insights/Profile).
 */
export default function MainTabs({ navigation }) {
  const [tab, setTab] = useState('HOME');
  const Content = CONTENT[tab];
  return (
    <View style={styles.shell}>
      <View style={styles.content}>
        <Content navigation={navigation} />
      </View>
      <TabBar active={tab} onChange={setTab} />
    </View>
  );
}

/**
 * Bottom tab bar following a token-based active/inactive system: the active tab
 * lights up with an indigo accent icon, bright label, and a small indicator dot;
 * inactive tabs are muted outline icons. No floating pill overlay.
 */
export function TabBar({ active, onChange }) {
  const { colors, fonts } = useTheme();

  return (
    <SafeAreaView style={[styles.tabSafe, { backgroundColor: colors.tabBar }]} edges={['bottom']}>
      <View
        testID="tab-bar"
        style={[styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }]}
      >
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tabItem}
              onPress={() => onChange(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={t.label}
            >
              <View style={styles.tabInner}>
                <View style={[styles.dot, isActive && { backgroundColor: colors.violet }]} accessibilityElementsHidden />
                <Ionicons
                  name={isActive ? t.iconActive : t.icon}
                  size={24}
                  color={isActive ? colors.violet : colors.textFaint}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? colors.violet : colors.textFaint, fontFamily: fonts.displaySemi },
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {t.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: { flex: 1 },
  tabSafe: {},
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tabItem: { flex: 1 },
  tabInner: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginBottom: 3,
    backgroundColor: 'transparent',
  },
  tabLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginTop: 3 },
  tabLabelActive: { fontWeight: '700' },
});