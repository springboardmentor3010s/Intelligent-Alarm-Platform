import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "./firebase";

export async function requestNotificationPermission(token) {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Notification permission was not granted.");
      return null;
    }

    const fcmToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    console.log("FCM Token:", fcmToken);

    if (!fcmToken) {
      console.error("FCM token was not generated.");
      return null;
    }

    // Send FCM token to FastAPI backend
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/notifications/register-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          token: fcmToken,
        }),
      },
    );

    const data = await response.json();

    console.log("FCM token registration response:", data);

    if (!response.ok) {
      console.error("Failed to register FCM token:", data);
      return null;
    }

    console.log("FCM token registered with backend successfully.");

    return fcmToken;
  } catch (error) {
    console.error("FCM setup error:", error);
    return null;
  }
}

// Listen for foreground FCM messages
export function listenForForegroundMessages() {
  onMessage(messaging, (payload) => {
    console.log("Foreground FCM message:", payload);

    const title = payload.notification?.title || "Intelligent Cognitive Alarm";

    const body = payload.notification?.body || "Your alarm is ready.";

    if (Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: "/favicon.svg",
      });
    }
  });
}
