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