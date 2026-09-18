# Real-Device Notification Checklist (Phase 3)

**Project**: CerebroKognit — Intelligent Cognitive Alarm Platform  
**Developer**: Pawan Simha R  
**Internship**: Infosys Virtual Internship 7.0  
**Project Guide & Mentor**: Shanmukha Priya  

Use this before claiming the alarm/notification workflow is delivered. Automated
tests cover the pure logic and the backend contract; they cannot prove that a
reminder actually fires on a phone. Tick every box on a physical device.

## 0. Prerequisites

- [ ] Backend reachable from the phone (`/health` returns 200 over LAN).
- [ ] `EXPO_PUBLIC_API_URL` blank (auto-detect LAN) or set to the host LAN IP.
- [ ] `PUSH_PROVIDER` set on the backend (`noop` proves wiring, `expo` for real push).
- [ ] For **push** (not local) notifications: a **development build** is installed
      (Expo Go on SDK 53+ cannot acquire an Expo push token). Local scheduling
      works in Expo Go.

## 1. Permissions

- [ ] Fresh install → opening the Alarms tab prompts for notification permission.
- [ ] Denying permission does not crash; the app still lists alarms.
- [ ] Granting permission arms the schedule (see "N on-device reminders armed").
- [ ] Android 13+: `POST_NOTIFICATIONS` appears in system settings for the app.
- [ ] Android 12+: exact-alarm access is requested/granted if the OS asks.

## 2. Local alarm fires (primary path)

- [ ] Create an alarm 2-3 minutes in the future via the app.
- [ ] `N on-device reminders armed` appears on the Alarms tab.
- [ ] Lock the phone and wait. The notification fires at the scheduled minute.
- [ ] The notification shows the alarm title and the challenge hint.
- [ ] Sound/vibration play (Android channel `cerebrokognit-alarms`, importance MAX).
- [ ] Works with the app backgrounded and fully closed.

## 3. Tap → challenge gate

- [ ] Tapping the notification opens the Alarm screen for **that** alarm
      (verify by giving it a distinct title; not the first enabled alarm).
- [ ] Cold start (app closed): tapping opens the Alarm screen after login.
- [ ] The challenge payload is shown with no answer leakage in the UI.
- [ ] Submitting wrong answers keeps the alarm locked (dismiss refused).
- [ ] Submitting all-correct dismisses the alarm and returns to Home.

## 4. Recurrence + rescheduling

- [ ] Dismissing a Daily alarm reschedules the next day's reminder on-device.
- [ ] A One-Time alarm is not re-armed after dismissal.
- [ ] Editing an alarm's time re-arms it at the new time (old reminder gone).
- [ ] Deleting an alarm removes its pending on-device reminder.

## 5. Push delivery (requires dev build + `PUSH_PROVIDER=expo`)

- [ ] `GET /api/v1/notifications/tokens` shows the registered Expo token.
- [ ] `GET /api/v1/notifications/status` reports `provider=expo`, `configured=true`.
- [ ] `POST /api/v1/notifications/test` delivers a notification to the device.
- [ ] `POST /api/v1/alarms/{id}/notify` delivers the alarm-due notification.
- [ ] Uninstalling the app + notifying prunes the dead token (`invalid_removed > 0`).
- [ ] `EXPO_ACCESS_TOKEN` set → no 401s from the Expo push endpoint.

## 6. Offline / failure handling

- [ ] Turn on airplane mode, open the Alarms tab → cached alarms shown + offline banner.
- [ ] Airplane mode: on-device reminders still fire (schedule is local).
- [ ] Dismiss while offline surfaces an error, not a crash.
- [ ] Reconnect → next focus syncs and re-arms the schedule.

## 7. Duplicate suppression

- [ ] Triggering the same alarm-due notification twice within a run sends once
      (backend dedupe key `alarm:{id}:{next_trigger}`).
- [ ] Re-opening the app does not re-fire an already-fired reminder for the same time.

## Sign-off

Record device, OS version, build type, and date. Do not mark Phase 3 "verified"
until sections 1-4 pass; note push (section 5) separately if no dev build was used.

- Device: ______________  OS: ______________  Build: Expo Go / dev build
- Date: ______________  Verified by: ______________
