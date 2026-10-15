/**
 * Service Worker for Intelligent Cognitive Alarm Platform
 * Handles offline caching, PWA installation lifecycle, and notification click deep-linking.
 */

const CACHE_NAME = "cognitive-alarm-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/icons.svg",
  "/alarm.mp3",
  "/manifest.webmanifest"
];

// Install: activate immediately without blocking
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Service worker cache prefetch note:", err);
      });
    })
  );
});

// Activate: take control of uncontrolled clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

// Notification Click Event: Deep-links to /cognitive-alarm?alarmId=<id>
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath = event.notification.data?.url || "/cognitive-alarm";
  const absoluteUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 1. Focus existing window if open and navigate to target route
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) {
            client.navigate(absoluteUrl);
          }
          return client.focus();
        }
      }
      // 2. Otherwise open new window directly to the cognitive alarm deep link
      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl);
      }
    })
  );
});

// Push Event: Handles incoming Web Push notifications if configured
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "Wake Up — Cognitive Challenge";
    const options = {
      body: payload.body || "Your alarm is ringing. Tap to start your cognitive challenge.",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: payload.tag || "cognitive-alarm-trigger",
      requireInteraction: true,
      data: payload.data || { url: "/cognitive-alarm" },
      actions: [
        { action: "open_alarm", title: "Open Alarm" }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.warn("Failed to process push payload:", err);
  }
});
