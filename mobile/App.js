import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuthContext } from './src/context/AuthContext';
import MainTabs from './src/components/MainTabs';
import AlarmScreen from './src/screens/AlarmScreen';
import AlarmFormScreen from './src/screens/AlarmFormScreen';
import ChallengeScreen from './src/screens/ChallengeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import { ActivityIndicator, View } from 'react-native';
import { BRAND } from './src/theme/tokens';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { isLoggedIn, loading: authLoading } = useAuthContext();

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.space }}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: BRAND.deepPurple },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: BRAND.space },
        }}
      >
        {!isLoggedIn ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ title: 'CEREBROKOGNIT', headerTitleAlign: 'center' }} />
            <Stack.Screen name="Alarm" component={AlarmScreen} options={{ title: 'Wake Up!' }} />
            <Stack.Screen name="AlarmForm" component={AlarmFormScreen} options={{ title: 'Configure Alarm' }} />
            <Stack.Screen name="Challenge" component={ChallengeScreen} options={{ title: 'Challenge' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Edit Profile' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}