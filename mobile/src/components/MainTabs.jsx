import React, { useState, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Animated } from 'react-native';
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
 * Floating pill navigation. The capsule bar sits on 16px gutters with a soft
 * elevation, and the emerald pill glides between tabs (pixel-based spring) so
 * the active accent visibly rides toward the tapped destination. The active tab
 * lights up (filled icon + bright label) on top of the sliding pill.
 */
export function TabBar({ active, onChange }) {
  const { colors, fonts } = useTheme();
  const [barWidth, setBarWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const lastIndex = useRef(0);

  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.key === active)
  );
  const tabWidth = barWidth > 0 ? barWidth / TABS.length : 0;

  useEffect(() => {
    if (tabWidth <= 0) return;
    const target = activeIndex * tabWidth;
    if (lastIndex.current !== activeIndex) {
      Animated.spring(slide, {
        toValue: target,
        damping: 22,
        stiffness: 180,
        mass: 1,
        useNativeDriver: true,
      }).start();
    } else {
      slide.setValue(target);
    }
    lastIndex.current = activeIndex;
  }, [activeIndex, tabWidth, slide]);

  return (
    <SafeAreaView style={styles.floatSafe} edges={['bottom']}>
      <View
        testID="tab-bar"
        style={[styles.floatBar, { backgroundColor: colors.tabBar, borderColor: colors.tabBarBorder }]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {tabWidth > 0 ? (
          <Animated.View
            testID="tab-slider"
            style={[
              styles.slider,
              {
                width: tabWidth - 16,
                backgroundColor: colors.emeraldSoft,
                borderColor: colors.emeraldGlow,
                transform: [{ translateX: slide }],
              },
            ]}
          />
        ) : null}
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
              <Ionicons
                name={isActive ? t.iconActive : t.icon}
                size={24}
                color={isActive ? colors.emerald : colors.textFaint}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.emerald : colors.textFaint, fontFamily: fonts.displaySemi },
                  isActive && styles.tabLabelActive,
                ]}
              >
                {t.label}
              </Text>
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
  floatSafe: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  floatBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 9999,
    overflow: 'hidden',
    paddingVertical: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,
  },
  slider: {
    position: 'absolute',
    left: 8,
    top: 5,
    bottom: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  tabItem: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6 },
  tabLabelActive: { fontWeight: '700' },
});