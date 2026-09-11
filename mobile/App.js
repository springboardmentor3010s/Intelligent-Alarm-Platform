import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuthContext } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useBrandFonts } from './src/theme/fonts';
import MainTabs from './src/components/MainTabs';
import AlarmScreen from './src/screens/AlarmScreen';
import AlarmFormScreen from './src/screens/AlarmFormScreen';
import ChallengeScreen from './src/screens/ChallengeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { isLoggedIn, loading: authLoading } = useAuthContext();
  const { colors, fonts } = useTheme();
  const [fontsLoaded, fontError] = useBrandFonts();

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.violet} />
      </View>
    );
  }

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.violet} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.violet,
          headerTitleStyle: { fontFamily: fonts.displaySemi, fontWeight: '700', color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {!isLoggedIn ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ title: 'CerebroKognit', headerTitleAlign: 'center' }} />
            <Stack.Screen name="Alarm" component={AlarmScreen} options={{ title: 'Solve to dismiss' }} />
            <Stack.Screen name="AlarmForm" component={AlarmFormScreen} options={{ title: 'Configure alarm' }} />
            <Stack.Screen name="Challenge" component={ChallengeScreen} options={{ title: 'Challenge' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Edit profile' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}