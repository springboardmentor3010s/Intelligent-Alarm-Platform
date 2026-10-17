// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/* eslint-disable import/no-extraneous-dependencies */
// Official AsyncStorage mock provided by @react-native-async-storage/async-storage.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Icon set depends on expo-font/expo-asset which aren't resolvable in the jest
// environment; render a lightweight view placeholder instead.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Icon = (props) => React.createElement(View, props);
  return new Proxy({}, { get: () => Icon });
});

// Brand font packages ship .ttf assets that cannot be loaded under jest.
// Mark every role as already loaded and expose the family names as strings so
// `fontFamily` props stay meaningful during render.
jest.mock('@expo-google-fonts/plus-jakarta-sans', () => {
  const names = [
    'PlusJakartaSans_300Light',
    'PlusJakartaSans_400Regular',
    'PlusJakartaSans_500Medium',
    'PlusJakartaSans_600SemiBold',
    'PlusJakartaSans_700Bold',
    'PlusJakartaSans_800ExtraBold',
  ];
  const mod = {};
  names.forEach((n) => { mod[n] = n; });
  return mod;
});

jest.mock('@expo-google-fonts/jetbrains-mono', () => {
  const names = [
    'JetBrainsMono_400Regular',
    'JetBrainsMono_500Medium',
    'JetBrainsMono_600SemiBold',
    'JetBrainsMono_700Bold',
  ];
  const mod = {};
  names.forEach((n) => { mod[n] = n; });
  return mod;
});

jest.mock('expo-font', () => {
  const useFonts = () => [true, null];
  const loadAsync = () => Promise.resolve({});
  const isLoaded = () => true;
  const isLoading = () => false;
  return { useFonts, loadAsync, isLoaded, isLoading };
});

// Google OAuth native modules have no JS-only implementation under jest; stub
// them so screens importing the sign-in helper still render in tests.
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => {
  class AuthRequest {
    constructor() {
      this.codeVerifier = 'test-verifier';
    }
    makeAuthUrlAsync() {
      return Promise.resolve('https://accounts.google.com/o/oauth2/v2/auth');
    }
    promptAsync() {
      return Promise.resolve({ type: 'dismiss' });
    }
  }
  return {
    AuthRequest,
    ResponseType: { Code: 'code' },
    makeRedirectUri: jest.fn(() => 'cerebrokognit://oauth'),
    exchangeCodeAsync: jest.fn(() => Promise.resolve({ idToken: 'test-id-token' })),
  };
});

// Expo SDK 58 lazily loads a native JS logger. TurboModuleRegistry is undefined in
// this Jest environment, so expo-modules-core hits its catch and console.warn()s -
// sometimes after the test file has finished. jest-runner turns any console call
// after teardown into process exit code 1, failing CI even though all tests pass.
// Stub the native module so requireOptionalNativeModule returns early, no warn.
if (globalThis.expo?.modules) {
  globalThis.expo.modules.ExpoModulesCoreJSLogger = { addListener: () => {} };
}