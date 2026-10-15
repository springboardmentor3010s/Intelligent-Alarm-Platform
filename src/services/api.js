import {
  DEMO_USER,
  DEMO_HABITS,
  DEMO_DASHBOARD_STATS,
  DEMO_HABIT_SCORE,
  DEMO_ALARMS,
  DEMO_RECOMMENDATIONS,
  DEMO_ADAPTIVE_DIFFICULTY,
  DEMO_SESSIONS,
  DEMO_REPORT_DATA,
  DEMO_ANALYTICS,
  DEMO_WAKE_UP_PREDICTION,
  DEMO_MODEL_INFO,
  DEMO_COACH_CLIENTS,
  DEMO_COACH_DASHBOARD,
} from "./demoData";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");

export function isDemoActive() {
  return (
    sessionStorage.getItem("demo_mode") === "true" ||
    localStorage.getItem("demo_mode") === "true"
  );
}

/* =========================================================
   COMMON HELPERS
========================================================= */

export function getClientTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getToken() {
  return localStorage.getItem("access_token");
}

function authHeaders(includeJson = false) {
  const headers = {
    Authorization: `Bearer ${getToken()}`,
    "X-User-Timezone": getClientTimeZone(),
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function parseResponse(response) {
  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      detail: text || "Unknown server error",
    };
  }

  if (!response.ok) {
    let message = "Something went wrong";

    if (typeof data.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data.detail)) {
      message = data.detail
        .map((item) => item.msg || JSON.stringify(item))
        .join(", ");
    } else if (data.message) {
      message = data.message;
    }

    throw new Error(message);
  }

  return data;
}

/* =========================================================
   AUTH
========================================================= */

export async function registerUser(userData) {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Timezone": getClientTimeZone(),
      },
      body: JSON.stringify(userData),
    }
  );

  return parseResponse(response);
}

export async function loginUser(userData) {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Timezone": getClientTimeZone(),
      },
      body: JSON.stringify(userData),
    }
  );

  return parseResponse(response);
}

export async function getCurrentUser() {
  if (isDemoActive()) {
    return DEMO_USER;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/auth/me`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

/* =========================================================
   ALARMS
========================================================= */

export async function getAlarms() {
  if (isDemoActive()) {
    return DEMO_ALARMS;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAlarm(id) {
  if (isDemoActive()) {
    const found = DEMO_ALARMS.find((a) => a.id === Number(id));
    return found || DEMO_ALARMS[0];
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms/${id}`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function createAlarm(alarmData) {
  if (isDemoActive()) {
    return {
      id: Date.now(),
      ...alarmData,
      is_active: true,
      message: "Demo Mode: Alarm creation simulated.",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms`,
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(alarmData),
    }
  );

  return parseResponse(response);
}

export async function updateAlarm(id, alarmData) {
  if (isDemoActive()) {
    return {
      id,
      ...alarmData,
      message: "Demo Mode: Alarm update simulated.",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms/${id}`,
    {
      method: "PUT",
      headers: authHeaders(true),
      body: JSON.stringify(alarmData),
    }
  );

  return parseResponse(response);
}

export async function toggleAlarm(id) {
  if (isDemoActive()) {
    const found = DEMO_ALARMS.find((a) => a.id === Number(id));
    return {
      id,
      is_active: found ? !found.is_active : false,
      message: "Demo Mode: Alarm toggle simulated.",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms/${id}/toggle`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function deleteAlarm(alarmId) {
  if (isDemoActive()) {
    return {
      message: "Demo Mode: Alarm deletion simulated.",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms/${alarmId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAlarmAdaptiveDifficulty(alarmId) {
  if (isDemoActive()) {
    return {
      alarm_id: Number(alarmId),
      previous_difficulty: "medium",
      results: ["correct", "correct"],
      decision: "increase",
      action: "INCREASE",
      next_difficulty: "hard",
      reason: "2/2 correct → Difficulty increased",
      adjusted: true,
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms/${alarmId}/adaptive-difficulty`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getDueAlarms() {
  if (isDemoActive()) {
    return { due_count: 0, due_alarms: [] };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms/triggers/due`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function triggerAlarm(alarmId, force = false) {
  if (isDemoActive()) {
    return {
      triggered: true,
      alarm_id: Number(alarmId),
      target_route: `/cognitive-alarm?alarmId=${alarmId}`,
      notification_title: "Wake Up — Cognitive Challenge",
      notification_body: "Demo alarm is ringing.",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms/${alarmId}/trigger?force=${force}`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAlarmTriggerStatus(alarmId) {
  if (isDemoActive()) {
    return { alarm_id: Number(alarmId), triggered_today: false };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/alarms/${alarmId}/trigger-status`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

/* =========================================================
   COGNITIVE ALARM
========================================================= */

export async function startAlarmSession(alarmId) {
  if (isDemoActive()) {
    return {
      id: 999,
      alarm_id: Number(alarmId),
      status: "active",
      user_id: DEMO_USER.id,
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/sessions/start/${alarmId}`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function generateChallenge(
  alarmId,
  challengeType = "math",
  difficulty = "medium"
) {
  if (isDemoActive()) {
    return {
      id: 999,
      session_id: 999,
      challenge_type: challengeType,
      difficulty: difficulty,
      question: "15 + 17 = ?",
      solution: "32",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/challenges/generate/${alarmId}`,
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        challenge_type: challengeType,
        difficulty: difficulty,
      }),
    }
  );

  return parseResponse(response);
}

export async function getChallenge(challengeId) {
  if (isDemoActive()) {
    return {
      id: Number(challengeId),
      challenge_type: "math",
      difficulty: "medium",
      question: "15 + 17 = ?",
      solution: "32",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/challenges/${challengeId}`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function submitChallengeAnswer(
  challengeId,
  answer
) {
  if (isDemoActive()) {
    return {
      correct: true,
      message: "Challenge completed in Demo Mode!",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/challenges/answer/${challengeId}`,
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        answer,
      }),
    }
  );

  return parseResponse(response);
}

export async function getAlarmSession(sessionId) {
  if (isDemoActive()) {
    return {
      id: Number(sessionId),
      status: "completed",
      correct: true,
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/sessions/${sessionId}`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

/* =========================================================
   DASHBOARD
========================================================= */

export async function getDashboardStats() {
  if (isDemoActive()) {
    return DEMO_DASHBOARD_STATS;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/dashboard/stats`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

/* =========================================================
   PROFILE
========================================================= */

export async function getProfile() {
  if (isDemoActive()) {
    return DEMO_USER;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/profile`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function updateProfile(profileData) {
  if (isDemoActive()) {
    return {
      ...DEMO_USER,
      ...profileData,
      message: "Demo Mode: Profile update simulated.",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/profile`,
    {
      method: "PUT",
      headers: authHeaders(true),
      body: JSON.stringify(profileData),
    }
  );

  return parseResponse(response);
}

/* =========================================================
   HABITS
========================================================= */

export async function getHabits() {
  if (isDemoActive()) {
    return DEMO_HABITS;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/habits`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function updateHabits(habitsData) {
  if (isDemoActive()) {
    return {
      habits: {
        ...DEMO_HABITS,
        ...habitsData,
      },
      message: "Demo Mode: Habits updated successfully.",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/habits`,
    {
      method: "PUT",
      headers: authHeaders(true),
      body: JSON.stringify(habitsData),
    }
  );

  return parseResponse(response);
}

/* =========================================================
   ADMIN
========================================================= */

export async function getAdminUsers() {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/users`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAdminUserDetail(userId) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/users/${userId}`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAdminStats() {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/stats`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function updateAdminUserRole(
  userId,
  role
) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/users/${userId}/role?role=${encodeURIComponent(
      role
    )}`,
    {
      method: "PUT",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function deleteAdminUser(userId) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/users/${userId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function toggleAdminAlarm(alarmId) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/alarms/${alarmId}/toggle`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function updateAdminAlarm(
  alarmId,
  alarmData
) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/alarms/${alarmId}`,
    {
      method: "PUT",
      headers: authHeaders(true),
      body: JSON.stringify(alarmData),
    }
  );

  return parseResponse(response);
}

export async function deleteAdminAlarm(alarmId) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/alarms/${alarmId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAdminAlarms() {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/alarms`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

/* =========================================================
   SESSION HISTORY
========================================================= */

export async function getSessionHistory() {
  if (isDemoActive()) {
    return { sessions: DEMO_SESSIONS };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/sessions/history`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function expireAlarmSession(sessionId) {
  if (isDemoActive()) {
    return {
      id: Number(sessionId),
      status: "expired",
      message: "Demo session expired.",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/sessions/${sessionId}/expire`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function snoozeSession(sessionId) {
  if (isDemoActive()) {
    return {
      id: Number(sessionId),
      status: "snoozed",
      snooze_count: 1,
      message: "Demo snooze simulated.",
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/sessions/${sessionId}/snooze`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

/* =========================================================
   COGNITIVE ANALYTICS & INTELLIGENCE (MILESTONE 3)
========================================================= */

export async function getAnalytics(timeRange = "all") {
  if (isDemoActive()) {
    return {
      ...DEMO_ANALYTICS,
      time_range: timeRange,
    };
  }

  const token = localStorage.getItem("access_token");
  const url = timeRange && timeRange !== "all"
    ? `${API_BASE_URL}/api/analytics?time_range=${encodeURIComponent(timeRange)}`
    : `${API_BASE_URL}/api/analytics`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Failed to load analytics"
    );
  }

  return data;
}

export async function getHabitScore() {
  if (isDemoActive()) {
    return DEMO_HABIT_SCORE;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/analytics/habit-score`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getRecommendations() {
  if (isDemoActive()) {
    return DEMO_RECOMMENDATIONS;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/analytics/recommendations`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAdaptiveDifficulty(alarmId = null) {
  if (isDemoActive()) {
    return DEMO_ADAPTIVE_DIFFICULTY;
  }

  const url = alarmId
    ? `${API_BASE_URL}/api/analytics/adaptive-difficulty?alarm_id=${encodeURIComponent(alarmId)}`
    : `${API_BASE_URL}/api/analytics/adaptive-difficulty`;

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse(response);
}

export async function getAdminSessions(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.append("status", params.status);
  if (params.search) query.append("search", params.search);
  if (params.limit) query.append("limit", params.limit);
  if (params.skip) query.append("skip", params.skip);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(
    `${API_BASE_URL}/api/admin/sessions${qs}`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAdminAnalytics() {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/analytics`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAdminMlMonitoring() {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/ml-monitoring`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function getAdminSystemReportSummary() {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/reports/summary`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function exportAdminSystemReportCsv() {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/reports/export/csv`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to export system report CSV.");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `System_Admin_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return { success: true };
}

/* =========================================================
   NOTIFICATIONS & ANNOUNCEMENTS (Phase 5)
========================================================= */

export async function getUserNotifications() {
  const response = await fetch(`${API_BASE_URL}/api/notifications`, {
    method: "GET",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function markNotificationRead(notificationId) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function markAllNotificationsRead() {
  const response = await fetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
    method: "POST",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function deleteUserNotification(notificationId) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function getPublicAnnouncements() {
  const response = await fetch(`${API_BASE_URL}/api/announcements`, {
    method: "GET",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function getAdminAnnouncements() {
  const response = await fetch(`${API_BASE_URL}/api/admin/announcements`, {
    method: "GET",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function createAdminAnnouncement(data) {
  const response = await fetch(`${API_BASE_URL}/api/admin/announcements`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(data),
  });
  return parseResponse(response);
}

export async function updateAdminAnnouncement(id, data) {
  const response = await fetch(`${API_BASE_URL}/api/admin/announcements/${id}`, {
    method: "PUT",
    headers: authHeaders(true),
    body: JSON.stringify(data),
  });
  return parseResponse(response);
}

export async function toggleAdminAnnouncement(id) {
  const response = await fetch(`${API_BASE_URL}/api/admin/announcements/${id}/toggle`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function deleteAdminAnnouncement(id) {
  const response = await fetch(`${API_BASE_URL}/api/admin/announcements/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseResponse(response);
}

/* =========================================================
   REPORTS & EXPORT (Milestone 4 — Phase 1)
========================================================= */

export async function getReportData() {
  if (isDemoActive()) {
    return DEMO_REPORT_DATA;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/reports/data`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

export async function downloadReport(format) {
  const isDemo = isDemoActive();
  let url = "";
  let defaultFilename = "";

  if (format === "pdf") {
    url = isDemo
      ? `${API_BASE_URL}/api/reports/demo/export-pdf`
      : `${API_BASE_URL}/api/reports/export/pdf`;
    defaultFilename = isDemo
      ? "Demo_Cognitive_Alarm_Report.pdf"
      : "Cognitive_Alarm_Report.pdf";
  } else if (format === "excel") {
    url = isDemo
      ? `${API_BASE_URL}/api/reports/demo/export-excel`
      : `${API_BASE_URL}/api/reports/export/excel`;
    defaultFilename = isDemo
      ? "Demo_Cognitive_Alarm_Report.xlsx"
      : "Cognitive_Alarm_Report.xlsx";
  } else if (format === "csv") {
    url = isDemo
      ? `${API_BASE_URL}/api/reports/demo/export-csv`
      : `${API_BASE_URL}/api/reports/export/csv`;
    defaultFilename = isDemo
      ? "Demo_Cognitive_Alarm_Report.csv"
      : "Cognitive_Alarm_Report.csv";
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }

  const headers = isDemo ? {} : authHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Failed to export ${format.toUpperCase()} report`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  let filename = defaultFilename;
  if (disposition && disposition.indexOf("filename=") !== -1) {
    const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, "");
    }
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

/* =========================================================
   MACHINE LEARNING PREDICTIONS (XGBOOST)
========================================================= */

export async function getWakeUpPrediction(alarmId = null) {
  if (isDemoActive()) {
    return DEMO_WAKE_UP_PREDICTION;
  }

  const query = alarmId ? `?alarm_id=${alarmId}` : "";
  const response = await fetch(`${API_BASE_URL}/api/predictions/wake-up${query}`, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse(response);
}

export async function getModelInfo() {
  if (isDemoActive()) {
    return DEMO_MODEL_INFO;
  }

  const response = await fetch(`${API_BASE_URL}/api/predictions/model-info`, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse(response);
}

/* =========================================================
   WELLNESS COACH PORTAL
========================================================= */

export async function getCoachDashboard() {
  if (isDemoActive()) {
    return DEMO_COACH_DASHBOARD;
  }

  const response = await fetch(`${API_BASE_URL}/api/coach/dashboard`, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse(response);
}

export async function getCoachClients(search = "") {
  if (isDemoActive()) {
    if (!search) return DEMO_COACH_CLIENTS;
    const term = search.toLowerCase();
    return DEMO_COACH_CLIENTS.filter(
      (c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
    );
  }

  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await fetch(`${API_BASE_URL}/api/coach/clients${query}`, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse(response);
}

export async function getClientSummary(clientId) {
  if (isDemoActive()) {
    const found = DEMO_COACH_CLIENTS.find((c) => c.id === Number(clientId));
    return found || DEMO_COACH_CLIENTS[0];
  }

  const response = await fetch(`${API_BASE_URL}/api/coach/clients/${clientId}`, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse(response);
}

export async function getClientInsights(clientId) {
  if (isDemoActive()) {
    const client = DEMO_COACH_CLIENTS.find((c) => c.id === Number(clientId)) || DEMO_COACH_CLIENTS[0];
    return {
      client,
      behavioral_summary: {
        total_alarms: client.total_alarms,
        active_alarms: client.active_alarms,
        total_sessions: client.total_sessions,
        completed_sessions: client.completed_sessions,
        completion_rate: client.completion_rate,
        accuracy_rate: 85.0,
        average_snooze_count: 0.35,
        average_response_time_seconds: 14.2,
      },
      habit_metrics: {
        overall_habit_score: client.habit_score,
        wake_up_consistency: 86.0,
        challenge_completion: 90.0,
        snooze_reduction: 80.0,
        sleep_schedule_adherence: 82.0,
      },
      ml_insights: {
        ml_behavioral_score: client.habit_score,
        ml_recommended_difficulty: client.difficulty_preference,
        ml_confidence: 0.88,
        recommendations: [
          {
            title: "Harmonize Bedtime with Wake Schedule",
            category: "sleep_improvement",
            priority: "high",
            description: "Maintaining a consistent 8-hour sleep window will stabilize morning awakenings.",
          },
        ],
      },
    };
  }

  const response = await fetch(`${API_BASE_URL}/api/coach/clients/${clientId}/insights`, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse(response);
}

export async function getClientHabits(clientId) {
  if (isDemoActive()) {
    const client = DEMO_COACH_CLIENTS.find((c) => c.id === Number(clientId)) || DEMO_COACH_CLIENTS[0];
    return {
      client_id: client.id,
      client_name: client.name,
      goals: {
        wake_up_goal: "Wake up energized by 06:30 AM without multiple snoozes",
        productivity_goals: "30 minutes morning cognitive workout and deep study",
        habit_preferences: "Prefer math and logic puzzles; strict 1-snooze limit",
      },
      adherence_metrics: {
        overall_habit_score: client.habit_score,
        wake_up_consistency: 86.0,
        challenge_completion: 90.0,
        snooze_reduction: 80.0,
        sleep_schedule_adherence: 82.0,
      },
      streak: 5,
      snooze_frequency: {
        zero_snooze: 10,
        one_snooze: 3,
        two_snoozes: 1,
        three_plus_snoozes: 0,
      },
    };
  }

  const response = await fetch(`${API_BASE_URL}/api/coach/clients/${clientId}/habits`, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse(response);
}

export async function getClientSleepTrends(clientId) {
  if (isDemoActive()) {
    const client = DEMO_COACH_CLIENTS.find((c) => c.id === Number(clientId)) || DEMO_COACH_CLIENTS[0];
    return {
      client_id: client.id,
      client_name: client.name,
      preferred_wake_time: client.preferred_wake_time,
      sleep_duration_hours: client.sleep_duration,
      sleep_adherence_percentage: 85.0,
      average_wake_drift_minutes: 6.4,
      total_evaluated_sessions: client.completed_sessions,
      wake_up_log: [
        {
          session_id: 1,
          alarm_id: 1,
          alarm_name: "Morning Focus",
          scheduled_alarm_time: client.preferred_wake_time,
          started_at_ist: "05 Oct 2026, 06:31:12 AM IST",
          completed_at_ist: "05 Oct 2026, 06:31:38 AM IST",
          actual_wake_time: "06:31 AM",
          drift_minutes: 1.2,
          on_time: true,
          snooze_count: 0,
          dismissal_status: "dismissed",
        },
      ],
    };
  }

  const response = await fetch(`${API_BASE_URL}/api/coach/clients/${clientId}/sleep`, {
    method: "GET",
    headers: authHeaders(),
  });

  return parseResponse(response);
}

export async function getClientAnalytics(clientId, timeRange = "all") {
  if (isDemoActive()) {
    const client = DEMO_COACH_CLIENTS.find((c) => c.id === Number(clientId)) || DEMO_COACH_CLIENTS[0];
    return {
      client_id: client.id,
      client_name: client.name,
      client_email: client.email,
      time_range: timeRange,
      report_summary: {
        total_sessions: client.total_sessions,
        completed_sessions: client.completed_sessions,
        habit_metrics: {
          overall_habit_score: client.habit_score,
        },
      },
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/api/coach/clients/${clientId}/analytics?time_range=${timeRange}`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );

  return parseResponse(response);
}

