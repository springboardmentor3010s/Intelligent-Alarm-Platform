import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
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
 * Bottom tab bar with a rounded pill that glides toward the active tab.
 * The indicator is a single overlay (no per-tab highlight box) so switching
 * Home -> Alarms -> Insights -> Profile animates a smooth slide between stops.
 */
export function TabBar({ active, onChange }) {
  const { colors } = useTheme();
  const [barWidth, setBarWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  const activeIndex = TABS.findIndex((t) => t.key === active);
  const targetIndex = activeIndex < 0 ? 0 : activeIndex;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: targetIndex,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();
  }, [targetIndex, slide]);

  const tabWidth = barWidth > 0 ? barWidth / TABS.length : 0;

  return (
    <SafeAreaView style={[styles.tabSafe, { backgroundColor: colors.tabBar }]} edges={['bottom']}>
      <View
        testID="tab-bar"
        style={[styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {barWidth > 0 && (
          <Animated.View
            testID="tab-slider"
            pointerEvents="none"
            style={[
              styles.slider,
              {
                backgroundColor: colors.violetSoft,
                borderColor: colors.violetGlow,
                width: tabWidth - 20,
                transform: [{ translateX: Animated.multiply(slide, tabWidth) }],
              },
            ]}
          />
        )}
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
              <Ionicons name={isActive ? t.iconActive : t.icon} size={20} color={isActive ? colors.violet : colors.textFaint} />
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
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 10,
  },
  slider: {
    position: 'absolute',
    left: 10,
    top: 6,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
  },
  tabItem: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginTop: 3 },
});