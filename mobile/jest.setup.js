/* eslint-disable import/no-extraneous-dependencies */
// Official AsyncStorage mock provided by @react-native-async-storage/async-storage.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);