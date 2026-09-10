import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BRAND } from '../theme/tokens';
import HomeTab from '../screens/tabs/HomeTab';
import AlarmsTab from '../screens/tabs/AlarmsTab';
import InsightsTab from '../screens/tabs/InsightsTab';
import ProfileTab from '../screens/tabs/ProfileTab';

const TABS = [
  { key: 'HOME', label: 'HOME', icon: 'rocket-outline', iconActive: 'rocket' },
  { key: 'ALARMS', label: 'ALARMS', icon: 'alarm-outline', iconActive: 'alarm' },
  { key: 'INSIGHTS', label: 'INSIGHTS', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { key: 'PROFILE', label: 'PROFILE', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

const CONTENT = {
  HOME: HomeTab,
  ALARMS: AlarmsTab,
  INSIGHTS: InsightsTab,
  PROFILE: ProfileTab,
};

/**
 * Tabbed main shell — custom bottom navigation (HOME/ALARMS/INSIGHTS/PROFILE)
 * rendered without an extra navigation dependency.
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
  return (
    <SafeAreaView style={styles.tabSafe} edges={['bottom']}>
      <View style={styles.tabBar}>
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
              <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                <Ionicons name={isActive ? t.iconActive : t.icon} size={20} color={isActive ? '#fff' : BRAND.textFaint} />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: BRAND.space },
  content: { flex: 1 },
  tabSafe: { backgroundColor: BRAND.deepPurple },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: BRAND.deepPurple,
    borderTopWidth: 1,
    borderTopColor: '#125C13',
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  tabIconWrap: {
    width: 40,
    height: 26,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: { backgroundColor: BRAND.primary },
  tabLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: BRAND.textFaint, marginTop: 3 },
  tabLabelActive: { color: BRAND.text },
});