// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
describe('expoNotifier in Expo Go on Android', () => {
  it('skips importing expo-notifications (which throws there) and reports unavailable', () => {
    jest.isolateModules(() => {
      let notificationsRequired = false;
      jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
      jest.doMock('../utils/env', () => ({
        __esModule: true,
        isExpoGo: () => true,
        default: { isExpoGo: () => true },
      }));
      jest.doMock('expo-notifications', () => {
        notificationsRequired = true;
        return {};
      });

      // eslint-disable-next-line global-require
      const notifier = require('./expoNotifier');
      expect(() => notifier.isAvailable()).not.toThrow();
      expect(notifier.isAvailable()).toBe(false);
      expect(notificationsRequired).toBe(false);
    });
  });
});
