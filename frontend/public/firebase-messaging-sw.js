importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCyI3AlNOYbGKnuVL8O9DwTdiBTYRpWmkE",
  authDomain: "alaram-ai-version.firebaseapp.com",
  projectId: "alaram-ai-version",
  storageBucket: "alaram-ai-version.firebasestorage.app",
  messagingSenderId: "232023861805",
  appId: "1:232023861805:web:caf0de4b019941cfb826a4",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message:", payload);

  const notificationTitle =
    payload.notification?.title || "Intelligent Cognitive Alarm";

  const notificationOptions = {
    body: payload.notification?.body || "Your alarm is ready.",
    icon: "/favicon.svg",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
