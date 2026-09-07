import { useState, useEffect, useCallback } from 'react';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, parseApiError, describeFetchError, authHeaders, onAuthExpired } from '../utils/api';
import { getExpoPushToken, registerPushToken } from '../notifications/registerPush';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('cerebro_token');
        const storedUser = await AsyncStorage.getItem('cerebro_user');

        if (storedToken && storedUser) {
          try {
            const response = await apiFetch('/api/v1/auth/me', {
              headers: authHeaders(storedToken),
            });
            if (response.ok) {
              setToken(storedToken);
              setUser(await response.json());
              setIsLoggedIn(true);
            } else {
              await AsyncStorage.removeItem('cerebro_token');
              await AsyncStorage.removeItem('cerebro_user');
            }
          } catch (e) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            setIsLoggedIn(true);
          }
        }
      } catch (e) {
        console.error('Failed to load auth state', e);
      } finally {
        setLoading(false);
      }
    };
    loadStoredAuth();
  }, []);

  useEffect(() => {
    const off = onAuthExpired(() => {
      setToken(null);
      setUser(null);
      setIsLoggedIn(false);
      AsyncStorage.removeItem('cerebro_token').catch(() => {});
      AsyncStorage.removeItem('cerebro_user').catch(() => {});
    });
    return off;
  }, []);

  const login = async (credentials) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { success: false, error: await parseApiError(response) };
      }

      const data = await response.json();
      setToken(data.access_token);
      setUser(data.user);
      await AsyncStorage.setItem('cerebro_token', data.access_token);
      await AsyncStorage.setItem('cerebro_user', JSON.stringify(data.user));
      setIsLoggedIn(true);

      // Request notifications (pass the fresh token explicitly)
      await registerForPushNotifications(data.access_token);

      return { success: true };
    } catch (error) {
      clearTimeout(timeout);
      return { success: false, error: describeFetchError(error) };
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
    await AsyncStorage.removeItem('cerebro_token');
    await AsyncStorage.removeItem('cerebro_user');
  };

  const updateUser = async (nextUser) => {
    setUser(nextUser);
    await AsyncStorage.setItem('cerebro_user', JSON.stringify(nextUser));
  };

  const refreshProfile = async () => {
    try {
      const response = await apiFetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const profile = await response.json();
        await updateUser(profile);
        return { success: true, user: profile };
      }
      return { success: false, error: await parseApiError(response) };
    } catch (error) {
      return { success: false, error: describeFetchError(error) };
    }
  };

  const registerForPushNotifications = useCallback(
    async (explicitToken = token) => {
      // Expo Go (SDK 53+) disables expo-notifications push; dev/physical builds use EAS.
      if (isRunningInExpoGo()) {
        console.log('Push registration skipped (Expo Go): remote push requires a development build.');
        return { registered: false, reason: 'expo-go' };
      }
      const authToken = explicitToken || token;
      try {
        const pushToken = await getExpoPushToken();
        if (!pushToken) {
          return { registered: false, reason: 'denied-or-unavailable' };
        }
        return await registerPushToken({
          token: pushToken,
          apiFetch,
          platform: Platform.OS,
          headers: authToken ? authHeaders(authToken) : undefined,
        });
      } catch (error) {
        console.error('Push notification registration error:', error);
        return { registered: false, reason: 'error' };
      }
    },
    [token]
  );

  return {
    user,
    token,
    isLoggedIn,
    login,
    logout,
    updateUser,
    refreshProfile,
    registerForPushNotifications
  };
}
