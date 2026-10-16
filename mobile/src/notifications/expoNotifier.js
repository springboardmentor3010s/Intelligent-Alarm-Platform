// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/**
 * Native notifier adapter around `expo-notifications`.
 *
 * All native access is isolated here so the scheduling logic
 * (`scheduleAlarm.js`) stays pure and testable. Every call is defensive: a
 * missing permission, an unsupported environment (Expo Go push limits), or a
 * native failure returns a safe value rather than crashing the screen.
 *
 * Local notifications work in Expo Go on iOS; on Android, Expo Go cannot load
 * `expo-notifications` at all (SDK 53+), so every call returns a safe value and
 * on-device alarms need a development build (see REAL_DEVICE_CHECKLIST.md).
 */

import { Platform } from 'react-native';
import { isExpoGo } from '../utils/env';

export const ANDROID_CHANNEL_ID = 'cerebrokognit-alarms';

let notificationsModule = null;

function getNotifications() {
  if (notificationsModule === null) {
    try {
      // Importing `expo-notifications` in Expo Go on Android evaluates its push
      // auto-registration side effect, which throws (SDK 53+ removed Android
      // remote push from Expo Go). Local alarms can't work there either, so
      // skip the import entirely instead of letting it throw.
      if (isExpoGo() && Platform.OS === 'android') {
        notificationsModule = false;
      } else {
        notificationsModule = require('expo-notifications');
      }
    } catch (e) {
      notificationsModule = false;
    }
  }
  return notificationsModule || null;
}

export function isAvailable() {
  return getNotifications() !== null;
}

/** Foreground presentation: show the banner + play sound for alarm notifications. */
export async function configureNotificationHandler() {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** Android: create the alarm channel (importance MAX + sound). */
export async function ensureAndroidChannel() {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS !== 'android') return false;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Alarms',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** Request notification permission. Returns true when granted. */
export async function ensurePermissions() {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  } catch (e) {
    return false;
  }
}

/** List scheduled notifications whose identifier belongs to an alarm. */
export async function getScheduledAlarmNotifications() {
  const Notifications = getNotifications();
  if (!Notifications) return [];
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const { isAlarmIdentifier } = require('./scheduleAlarm');
    return (scheduled || []).filter((n) => isAlarmIdentifier(n.identifier));
  } catch (e) {
    return [];
  }
}

/** Cancel every previously-scheduled alarm notification. Returns the count. */
export async function cancelAllAlarmNotifications() {
  const Notifications = getNotifications();
  if (!Notifications) return 0;
  const existing = await getScheduledAlarmNotifications();
  let cancelled = 0;
  for (const item of existing) {
    try {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
      cancelled += 1;
    } catch (e) {
      // ignore individual cancel failures
    }
  }
  return cancelled;
}

/** Schedule one alarm notification at an absolute Date. */
export async function schedule(identifier, date, content) {
  const Notifications = getNotifications();
  if (!Notifications) throw new Error('notifications-unavailable');
  const trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
  const payload = {
    ...content,
    ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
  };
  return Notifications.scheduleNotificationAsync({ identifier, content: payload, trigger });
}

/** Subscribe to notification taps. Returns an unsubscribe function. */
export function addNotificationResponseListener(handler) {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      handler(data, response);
    });
    return () => {
      try {
        sub.remove();
      } catch (e) {}
    };
  } catch (e) {
    return () => {};
  }
}

/** Read the alarm id from the notification that cold-started the app (if any). */
export async function getInitialAlarmId() {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    const data = response?.notification?.request?.content?.data || {};
    return data.type === 'alarm' && data.alarm_id ? data.alarm_id : null;
  } catch (e) {
    return null;
  }
}

export function extractAlarmId(data) {
  if (!data || data.type !== 'alarm') return null;
  return data.alarm_id || null;
}

export default {
  ANDROID_CHANNEL_ID,
  isAvailable,
  configureNotificationHandler,
  ensureAndroidChannel,
  ensurePermissions,
  getScheduledAlarmNotifications,
  cancelAllAlarmNotifications,
  schedule,
  addNotificationResponseListener,
  getInitialAlarmId,
  extractAlarmId,
};
