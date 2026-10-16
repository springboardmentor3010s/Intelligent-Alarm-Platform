// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import { isExpoGo } from './env';

describe('isExpoGo', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('expo-constants');
    jest.dontMock('expo');
  });

  it('is true when executionEnvironment is storeClient', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { executionEnvironment: 'storeClient' },
    }));
    const { isExpoGo: detect } = require('./env');
    expect(detect()).toBe(true);
  });

  it('falls back to expo.isRunningInExpoGo for non-storeClient', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { executionEnvironment: 'bare' },
    }));
    jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
    const { isExpoGo: detect } = require('./env');
    expect(detect()).toBe(true);
  });

  it('is false outside Expo Go', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { executionEnvironment: 'bare' },
    }));
    jest.doMock('expo', () => ({ isRunningInExpoGo: () => false }));
    const { isExpoGo: detect } = require('./env');
    expect(detect()).toBe(false);
  });

  it('default export exposes isExpoGo', () => {
    expect(typeof isExpoGo).toBe('function');
  });
});
