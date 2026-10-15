/**
 * Notification Service Utility
 * Coordinates browser Web Notifications, permission checks, sound alerts,
 * and user preference management for Phase 5.
 */

const PREFERENCES_KEY = "cognitive_alarm_notification_preferences";

const DEFAULT_PREFERENCES = {
  bedtime_reminders_enabled: true,
  advance_wake_reminders_enabled: true,
  advance_reminder_minutes: 15,
  habit_alerts_enabled: true,
  challenge_reminders_enabled: true,
  progress_notifications_enabled: true,
  sound_enabled: true,
};

export function getStoredPreferences() {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences) {
  try {
    const merged = { ...getStoredPreferences(), ...preferences };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.error("Failed to save notification preferences:", err);
    return DEFAULT_PREFERENCES;
  }
}

export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return { status: "unsupported", granted: false };
  }
  try {
    const permission = await Notification.requestPermission();
    return { status: permission, granted: permission === "granted" };
  } catch (err) {
    console.warn("Notification request permission error:", err);
    return { status: "denied", granted: false };
  }
}

export function showBrowserNotification(title, options = {}) {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return null;
  }
  try {
    const n = new Notification(title, {
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      ...options,
    });
    n.onclick = () => {
      window.focus();
      if (options.onClick) options.onClick();
      n.close();
    };
    return n;
  } catch (err) {
    console.warn("Failed to dispatch browser notification:", err);
    return null;
  }
}

/**
 * Dispatches a prominent Wake-Up & Cognitive Challenge notification
 * utilizing Service Worker if available, with deep linking to /cognitive-alarm?alarmId=<id>.
 */
export async function showAlarmBrowserNotification(alarm, onOpen) {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return null;
  }

  const title = "Wake Up — Cognitive Challenge";
  const body = `Your alarm '${alarm.name || "Morning Alarm"}' is ringing. Tap to start your cognitive challenge.`;
  const targetUrl = `/cognitive-alarm?alarmId=${alarm.id}`;

  // Try Service Worker registration first for optimal background/PWA click routing
  if ("serviceWorker" in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 800)),
      ]);
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, {
          body,
          icon: "/favicon.svg",
          badge: "/favicon.svg",
          tag: `alarm-ring-${alarm.id}`,
          requireInteraction: true,
          data: {
            alarmId: alarm.id,
            url: targetUrl,
          },
          actions: [
            { action: "open_alarm", title: "Open Alarm" },
          ],
        });
        return true;
      }
    } catch (e) {
      console.warn("Service worker showNotification fallback:", e);
    }
  }

  // Fallback to standard window Notification
  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: `alarm-ring-${alarm.id}`,
      requireInteraction: true,
      data: {
        alarmId: alarm.id,
        url: targetUrl,
      },
    });

    notification.onclick = () => {
      window.focus();
      if (onOpen) {
        onOpen(alarm);
      } else {
        window.location.href = targetUrl;
      }
      notification.close();
    };

    return notification;
  } catch (err) {
    console.warn("Standard notification failed:", err);
    return null;
  }
}

