// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/**
 * Push-notification registration helper.
 *
 * Pure async logic (no native imports at module top) so it is testable:
 *   registerPushToken({ token, apiFetch, platform }) -> { registered, token }
 *   getExpoPushToken(...) -> raw Expo push token (native; mocked in tests / Expo Go)
 *
 * In Expo Go (SDK 53+) expo-notifications push is disabled, so native token
 * acquisition returns null and registration is skipped — same guard the
 * previous flow used.
 */
import { Platform } from 'react-native';

export const EXPO_PUSH_TAG = 'ExpoPushToken';

export function nowIso() {
  return new Date().toISOString();
}

/**
 * Register the given push token against /api/v1/notifications/register.
 * apiFetch and platform are injectable for tests.
 */
export async function registerPushToken({
  token,
  apiFetch,
  platform,
  headers,
}) {
  if (!token) {
    return { registered: false, reason: 'no-token' };
  }
  const actualPlatform = platform || (Platform.OS === 'ios' ? 'ios' : 'android');
  const response = await apiFetch('/api/v1/notifications/register', {
    method: 'POST',
    headers: {
      ...(headers || {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, platform: actualPlatform }),
  });
  if (response && response.ok) {
    return { registered: true, token };
  }
  return { registered: false, reason: 'not-ok', status: response && response.status };
}

/**
 * Acquire an Expo push token via expo-notifications (native). Resolves null
 * when running in Expo Go or when permissions are denied. Returns a fresh
 * token only — does NOT persist anything.
 */
export async function getExpoPushToken() {
  try {
    const { isRunningInExpoGo } = require('expo');
    if (isRunningInExpoGo()) {
      return null;
    }
    const { default: Notifications } = await import('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data || null;
  } catch {
    return null;
  }
}

/**
 * High-level flow: acquire a token (if possible) and register it.
 * Returns { registered, token, reason }.
 */
export async function acquireAndRegister({ apiFetch, token: authToken, platform }) {
  const pushToken = await getExpoPushToken();
  if (!pushToken) {
    return { registered: false, reason: 'expo-go-or-denied', token: null };
  }
  return registerPushToken({
    token: pushToken,
    apiFetch,
    platform,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
}

export default { getExpoPushToken, registerPushToken, acquireAndRegister };