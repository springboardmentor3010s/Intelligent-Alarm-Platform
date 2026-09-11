import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

export function TabBar({ active, onChange }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.tabSafe, { backgroundColor: colors.tabBar }]} edges={['bottom']}>
      <View style={[styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }]}>
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
              <View style={[styles.tabIconWrap, isActive && { backgroundColor: colors.violetSoft }]}>
                <Ionicons name={isActive ? t.iconActive : t.icon} size={20} color={isActive ? colors.violet : colors.textFaint} />
              </View>
              <Text style={[styles.tabLabel, { color: isActive ? colors.violet : colors.textFaint }]}>{t.label}</Text>
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
    paddingBottom: 4,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  tabIconWrap: { width: 40, height: 26, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginTop: 3 },
});