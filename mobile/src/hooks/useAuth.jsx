import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/api';

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
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setIsLoggedIn(true);
        }
      } catch (e) {
        console.error('Failed to load auth state', e);
      } finally {
        setLoading(false);
      }
    };
    loadStoredAuth();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setToken(data.access_token);
        setUser(data.user);
        await AsyncStorage.setItem('cerebro_token', data.access_token);
        await AsyncStorage.setItem('cerebro_user', JSON.stringify(data.user));
        setIsLoggedIn(true);
        
        // Request notifications
        await registerForPushNotifications();
        
        return { success: true };
      }
      return { success: false, error: data.detail || 'Login failed' };
    } catch (error) {
      return { success: false, error: 'Network error' };
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
      return { success: false, error: 'Failed to load profile' };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const registerForPushNotifications = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') return;

      const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Push token:', pushToken);
      
    } catch (error) {
      console.error('Push notification registration error:', error);
    }
  };

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
