# Real Alarm Notification & Wake-Up Trigger Architecture

This document provides a comprehensive technical overview of the real alarm triggering, browser/PWA notifications, service worker lifecycle, deep-linking, duplicate protection, and mobile integration boundaries for the Intelligent Cognitive Alarm Platform.

---

## 1. How Alarm Triggering Works

1. **User Scheduling**:
   - The user creates or updates an alarm with a scheduled time (e.g. `07:00`), repeat pattern (`daily`, `weekly`, `weekdays`, `weekends`), and cognitive challenge preferences (`challenge_type`, `difficulty`) via the Alarms page or `/api/alarms`.
   - The alarm is stored in PostgreSQL in the `alarms` table with `is_active = True`.

2. **Timezone-Aware Evaluation**:
   - Each user profile optionally defines a timezone (`UserProfile.time_zone`, e.g., `'America/New_York'`, `'Asia/Kolkata'`).
   - The backend service `app.services.alarm_trigger_service` dynamically converts the current UTC clock to the user's localized datetime using Python's standard `zoneinfo.ZoneInfo`.
   - The alarm's scheduled time (`Time`) is matched against the localized hour and minute.

3. **Due Alarm Scanning**:
   - **Client Watcher**: When the web application is open in any tab, the global `AlarmWatcher` component (`src/components/AlarmWatcher.jsx`) evaluates active alarms every 10 seconds.
   - **Server Endpoint**: `GET /api/alarms/triggers/due` evaluates due alarms on the server and provides idempotent triggering with cross-worker protection.
   - **Trigger Endpoint**: `POST /api/alarms/{id}/trigger` executes the alarm trigger, generating a system `UserNotification` record of category `alarm_trigger`.

---

## 2. How Browser Notifications Work

1. **Permission Lifecycle**:
   - In accordance with web standards, notification permissions (`Notification.requestPermission()`) are never requested repeatedly or on initial page load without user gesture.
   - The user can grant permission via the **Alarm Notifications** card in the Alarms page or Cognitive Alarm view.
   - Permission status (`granted`, `denied`, `default`, `unsupported`) is stored and displayed in the UI.

2. **Notification Dispatch**:
   - When an alarm triggers, `showAlarmBrowserNotification` in `src/services/notificationService.js` creates a prominent notification:
     - **Title**: `"Wake Up — Cognitive Challenge"`
     - **Body**: `"Your alarm '<alarm name>' is ringing. Tap to start your cognitive challenge."`
     - **Action**: `"Open Alarm"`
     - **Metadata**: `{ alarmId, url: '/cognitive-alarm?alarmId=<id>' }`
   - If Service Worker is active, it dispatches via `ServiceWorkerRegistration.showNotification()`. Otherwise, it falls back to the window `Notification` API.

---

## 3. How the Service Worker Works

- **File**: `public/sw.js`
- **Scope**: Entire origin `/`
- **Registration**: Registered during application bootstrap in `src/main.jsx`.
- **Cache Strategy**: Prefetches core shell assets (`/`, `/index.html`, `/manifest.webmanifest`, `/alarm.mp3`, icons). Served with `Cache-Control: "no-cache, no-store, must-revalidate"` via Nginx to ensure instantaneous updates.
- **Push Ready**: Implements standard `push` listener for future Web Push server integration.

---

## 4. How Notification Click Opens the Cognitive Alarm

When a user taps or clicks the notification:
1. The Service Worker's `notificationclick` listener extracts the target deep-link route:
   ```javascript
   const targetUrl = event.notification.data?.url || "/cognitive-alarm";
   ```
2. It queries open browser clients using `clients.matchAll({ type: 'window', includeUncontrolled: true })`.
3. If an existing tab/window of the application is found:
   - Navigates the tab to `/cognitive-alarm?alarmId=<id>`.
   - Calls `client.focus()` to bring the tab into foreground focus.
4. If no tab is open:
   - Calls `clients.openWindow(targetUrl)` to launch the application directly to the alarm screen.

---

## 5. Direct Cognitive Alarm Deep-Link Entry

- **Route**: `/cognitive-alarm?alarmId=<id>`
- **Workflow**:
  1. The page parses the query string parameter `alarmId`.
  2. It validates that the alarm exists in the authenticated user's alarms loaded from `/api/alarms`.
  3. If valid, it starts the ringing alarm screen:
     - Displays pulsating ringing header: `"Wake Up — Cognitive Challenge"`.
     - Displays alarm name, scheduled time, and challenge type.
     - Automatically starts alarm sound playback (`/alarm.mp3`) if sound is enabled.
     - Calls `/api/sessions/start/{alarm_id}` to initialize or resume the session.
     - Retrieves the challenge via `/api/challenges/{challenge_id}` (with `correct_answer` strictly concealed).
     - Renders the interactive challenge solver, timer, and snooze control (`/api/sessions/{session_id}/snooze`).
  4. If the alarm belongs to another user or is deleted, access is blocked and an unauthorized/not found error is shown. URL parameters alone can never bypass backend ownership authorization.

---

## 6. Behavior Across Tab States

### A. App Open (Active Tab)
- Alarm triggers immediately.
- Displays prominent ringing banner, plays alarm sound, and shows the cognitive challenge interface.

### B. App Open (Tab in Background / Inactive)
- Browser `setInterval` in `AlarmWatcher` detects the scheduled time.
- System/browser notification appears over the operating system desktop or mobile notification shade.
- If sound is permitted, the audio continues to ring in the background tab.
- Clicking the notification focuses the tab and directs the user to `/cognitive-alarm?alarmId=<id>`.

### C. Browser Tab Closed (Browser Process Still Running)
- If the browser or PWA is running in the background, a Service Worker can receive Web Push events from the server and display the system notification.
- Clicking the notification opens a new window directly to `/cognitive-alarm?alarmId=<id>`.

### D. Browser Process Completely Terminated
- **Technical Limitation**:
  > "Web browsers do not provide the same guaranteed background alarm execution as native Android Alarm Manager or iOS local notifications when the browser process is completely terminated."
- Desktop operating systems (Windows, macOS, Linux) and mobile OSes (Android, iOS) do not allow arbitrary web JavaScript execution when the user has force-closed or swiped away the browser process.
- No web application or browser polling can bypass OS process termination.

---

## 7. Duplicate Trigger Protection (Idempotency)

The platform guarantees that an alarm cannot trigger multiple times on the same calendar day due to page refreshes, multiple browser tabs, backend restarts, or multi-worker Uvicorn processes:

1. **Client-Side Deduplication**:
   - `AlarmWatcher` writes a local storage key: `alarm_triggered_<alarm_id>_<YYYY-MM-DD>`.
   - Subsequent checks in the same or other tabs find this flag and skip duplicate triggers.

2. **Server-Side Idempotency**:
   - Before executing a trigger, `app.services.alarm_trigger_service` checks whether:
     - An `alarm_trigger` notification already exists for this alarm since the start of today in the user's timezone.
     - An `AlarmSession` was already created for this alarm today.
   - If either exists, `trigger_alarm_for_user` suppresses duplicate execution and returns `{"triggered": False, "status": "already_triggered_today"}`.
   - Even if multiple Uvicorn workers inspect the alarm at the same moment, transactional database verification ensures only a single occurrence is created.

---

## 8. Native Android / iOS Future Integration Path

The architecture was intentionally decoupled so native mobile applications can be introduced without altering backend business logic:

1. **Shared Backend Core**:
   - Native Android/iOS apps authenticate via the existing JWT endpoint `/api/auth/login`.
   - The mobile app fetches active alarms via `/api/alarms`.
2. **Native Scheduling**:
   - On Android: The app schedules exact wake-up intents using Android's `AlarmManager.setExactAndAllowWhileIdle()` or `WorkManager`.
   - On iOS: The app registers local notifications using `UNUserNotificationCenter`.
3. **Execution**:
   - When the native alarm fires (even if phone is asleep or app was terminated), Android's `BroadcastReceiver` launches the alarm screen.
   - The app calls the existing `/api/sessions/start/{alarm_id}` endpoint to fetch the cognitive challenge.
   - User answers and dismissals post to `/api/challenges/answer/{challenge_id}` and `/api/sessions/{session_id}/snooze`, seamlessly feeding into the existing XGBoost adaptive difficulty engine, analytics, habit score, and coach dashboards.

---

## 9. How to Test the Feature Locally

### Method A: Immediate Verification via "Test Alarm" Button
1. Log in to the application at `http://localhost:5173` (or `http://localhost`).
2. Navigate to the **Alarms** page (`/alarms`).
3. Click the **🔔 Test Alarm** button on any alarm card.
4. The application navigates to `/cognitive-alarm?alarmId=<id>`:
   - A prominent **"Wake Up — Cognitive Challenge"** ringing card appears.
   - Alarm audio plays (if enabled).
   - The cognitive challenge for that alarm loads.
   - Enter the answer or click Snooze to verify complete workflow execution.

### Method B: Testing Real Scheduled Alarm Trigger
1. In the **Alarms** page, click **＋ Create Alarm**.
2. Set the scheduled time to 1 minute ahead of your current computer clock.
3. Click **🔔 Enable Notifications** on the Alarms page banner and allow notifications when prompted by your browser.
4. Optionally switch to another tab or minimize the browser window.
5. When the scheduled minute arrives:
   - A system notification titled **"Wake Up — Cognitive Challenge"** pops up.
   - Click the notification: the browser focuses and deep-links directly to `/cognitive-alarm?alarmId=<id>`.
   - Complete the cognitive challenge to dismiss the alarm.

### Method C: Automated Test Suite
Run the automated test suite from the project root:
```bash
.\backend\venv\Scripts\python.exe backend/test_alarm_trigger_system.py
```
All 10 test groups (covering future scheduling, timezone resolution, inactive/deleted alarm suppression, cross-user isolation, duplicate protection, and deep-link session lifecycles) will execute and output a 100% pass report.
