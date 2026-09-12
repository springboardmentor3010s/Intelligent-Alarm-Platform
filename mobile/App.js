import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, View } from 'react-native';
import { AuthProvider, useAuthContext } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useBrandFonts } from './src/theme/fonts';
import MainTabs from './src/components/MainTabs';
import HeaderActions from './src/components/layout/HeaderActions';
import AlarmScreen from './src/screens/AlarmScreen';
import AlarmFormScreen from './src/screens/AlarmFormScreen';
import ChallengeScreen from './src/screens/ChallengeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AboutScreen from './src/screens/AboutScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import LoginScreen from './src/screens/LoginScreen';

const LOGO_DARK = require('./assets/logos/WideDark.webp');
const LOGO_LIGHT = require('./assets/logos/WideLight.webp');

const Stack = createNativeStackNavigator();

function HomeHeaderLogo() {
  const { resolved } = useTheme();
  return (
    <Image
      source={resolved === 'light' ? LOGO_LIGHT : LOGO_DARK}
      style={{ width: 168, height: 26 }}
      resizeMode="contain"
      accessibilityLabel="CerebroKognit"
    />
  );
}

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
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={({ navigation }) => ({
                headerTitle: () => <HomeHeaderLogo />,
                headerTitleAlign: 'left',
                headerRight: () => <HeaderActions navigation={navigation} />,
              })}
            />
            <Stack.Screen name="Alarm" component={AlarmScreen} options={{ title: 'Solve to dismiss' }} />
            <Stack.Screen name="AlarmForm" component={AlarmFormScreen} options={{ title: 'Configure alarm' }} />
            <Stack.Screen name="Challenge" component={ChallengeScreen} options={{ title: 'Challenge' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Edit profile' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: 'Send feedback' }} />
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