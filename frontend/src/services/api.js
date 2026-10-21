import axios from "axios";

const API_BASE_URLS = [
  import.meta.env?.VITE_API_BASE_URL,
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:8001",
  "http://127.0.0.1:8001",
].filter(Boolean);

let selectedApiBaseUrl =
  localStorage.getItem("api_base_url") || API_BASE_URLS[0] || "http://127.0.0.1:8000";

function setApiBaseUrl(baseURL) {
  selectedApiBaseUrl = baseURL;
  api.defaults.baseURL = baseURL;
  localStorage.setItem("api_base_url", baseURL);
}

async function resolveApiBaseUrl() {
  const candidates = [...new Set([selectedApiBaseUrl, ...API_BASE_URLS])];
  for (const candidate of candidates) {
    try {
      const response = await axios.get(`${candidate}/`, {
        timeout: 1200,
        validateStatus: () => true,
      });

      if (response.status < 500) {
        setApiBaseUrl(candidate);
        return candidate;
      }
    } catch {
      // try the next candidate
    }
  }

  if (!selectedApiBaseUrl) {
    selectedApiBaseUrl = API_BASE_URLS[0] || "http://127.0.0.1:8000";
  }

  api.defaults.baseURL = selectedApiBaseUrl;
  return selectedApiBaseUrl;
}

function createApiClient(baseURL = selectedApiBaseUrl) {
  return axios.create({
    baseURL,
    timeout: 8000,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const api = createApiClient();

/* =========================================================
   AUTHENTICATION
========================================================= */

export function getToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }

  return null;
}

function authHeaders() {
  const token = getToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function notifyPerformanceUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cognitive-alarm:performance-updated"));
  }
}

/* =========================================================
   REQUEST INTERCEPTOR
========================================================= */

api.interceptors.request.use(
  (config) => {
    config.headers = {
      ...config.headers,
      ...authHeaders(),
    };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

async function requestWithFallback(config) {
  const baseURL = await resolveApiBaseUrl();
  setApiBaseUrl(baseURL);
  return api.request(config);
}

/* =========================================================
   RESPONSE INTERCEPTOR
========================================================= */

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.url !== "/api/auth/login"
    ) {
      logoutUser();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("cognitive_alarm_user");
        window.dispatchEvent(new Event("cognitive-alarm:session-expired"));
      }
    }

    return Promise.reject(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Something went wrong"
    );
  }
);

/* =========================================================
   REGISTER
========================================================= */

export async function registerUser(userData) {
  const response = await requestWithFallback({
    method: "POST",
    url: "/api/auth/register",
    data: userData,
  });

  return response.data;
}

/* =========================================================
   LOGIN
========================================================= */

export async function loginUser(email, password) {
  const formData = new URLSearchParams();

  formData.append("username", email);
  formData.append("password", password);

  const response = await requestWithFallback({
    method: "POST",
    url: "/api/auth/login",
    data: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (response.data?.access_token) {
    localStorage.setItem(
      "access_token",
      response.data.access_token
    );
  }

  return response.data;
}

/* =========================================================
   LOGOUT
========================================================= */

export function logoutUser() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
  }
}

/* =========================================================
   CURRENT USER
========================================================= */

export async function getCurrentUser() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/auth/me",
  });

  return response.data;
}

/* =========================================================
   PROFILE
========================================================= */

export async function getProfile() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/profile",
  });

  return response.data;
}

export async function updateProfile(profileData) {
  const response = await requestWithFallback({
    method: "PUT",
    url: "/api/profile",
    data: profileData,
  });

  return response.data;
}

/* =========================================================
   ALARMS
========================================================= */

export async function getAlarms() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/alarms",
  });

  return response.data;
}

export async function createAlarm(alarmData) {
  const response = await requestWithFallback({
    method: "POST",
    url: "/api/alarms",
    data: alarmData,
  });

  return response.data;
}

export async function updateAlarm(alarmId, alarmData) {
  const response = await requestWithFallback({
    method: "PUT",
    url: `/api/alarms/${alarmId}`,
    data: alarmData,
  });

  return response.data;
}

export async function deleteAlarm(alarmId) {
  const response = await requestWithFallback({
    method: "DELETE",
    url: `/api/alarms/${alarmId}`,
  });

  return response.data;
}

/* =========================================================
   ALARM ACTIONS
========================================================= */

export async function snoozeAlarm(alarmId) {
  const response = await requestWithFallback({
    method: "POST",
    url: `/api/alarms/${alarmId}/snooze`,
    data: {},
  });

  notifyPerformanceUpdated();
  return response.data;
}

export async function completeAlarm(alarmId, sessionId) {
  const response = await requestWithFallback({
    method: "POST",
    url: `/api/alarms/${alarmId}/complete`,
    data: { session_id: sessionId },
  });

  notifyPerformanceUpdated();
  return response.data;
}

export async function triggerAlarm(alarmId) {
  const response = await requestWithFallback({
    method: "POST",
    url: `/api/alarms/${alarmId}/trigger`,
    data: {},
  });

  notifyPerformanceUpdated();
  return response.data;
}

/* =========================================================
   CHALLENGES
========================================================= */

export async function generateChallenge(alarmId) {
  const response = await requestWithFallback({
    method: "POST",
    url: `/api/challenges/generate/${alarmId}`,
    data: {},
  });

  return response.data;
}

export async function getChallenges() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/challenges",
  });

  return response.data;
}

export async function submitChallengeAnswer(
  challengeId,
  answer,
  responseTimeSeconds
) {
  const response = await requestWithFallback({
    method: "POST",
    url: `/api/challenges/${challengeId}/submit`,
    params: {
      answer: answer,
      response_time_seconds: responseTimeSeconds,
    },
  });

  if (response.data?.attempt_count) {
    notifyPerformanceUpdated();
  }
  return response.data;
}

/* =========================================================
   DASHBOARD
========================================================= */

export async function getDashboardStats() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/dashboard/stats",
  });

  return response.data;
}

export async function getPerformanceStats() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/dashboard/performance",
  });

  return response.data;
}

/* =========================================================
   RECOMMENDATIONS
========================================================= */

export async function getRecommendations() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/dashboard/recommendations",
  });

  return response.data;
}

export async function getRecommendationHistory() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/dashboard/recommendations/history",
  });

  return response.data;
}

export async function getNotifications() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/notifications",
  });
  return response.data;
}

export async function getUnreadNotificationCount() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/notifications/unread-count",
  });
  return response.data.unread_count;
}

export async function markNotificationRead(notificationId) {
  const response = await requestWithFallback({
    method: "PUT",
    url: `/api/notifications/${notificationId}/read`,
  });
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await requestWithFallback({
    method: "PUT",
    url: "/api/notifications/read-all",
  });
  return response.data;
}

export async function deleteNotification(notificationId) {
  const response = await requestWithFallback({
    method: "DELETE",
    url: `/api/notifications/${notificationId}`,
  });
  return response.data;
}

export async function generateReminders() {
  const response = await requestWithFallback({
    method: "POST",
    url: "/api/notifications/generate-reminders",
  });
  return response.data;
}

export async function getCoachOverview() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/coach/overview",
  });
  return response.data;
}

export async function getCoachClients() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/coach/clients",
  });
  return response.data;
}

export async function getCoachClientBehavior(clientId) {
  const response = await requestWithFallback({
    method: "GET",
    url: `/api/coach/clients/${clientId}/behavior`,
  });
  return response.data;
}

export async function sendCoachRecommendation(clientId, recommendation) {
  const response = await requestWithFallback({
    method: "POST",
    url: `/api/coach/clients/${clientId}/recommendation`,
    data: recommendation,
  });
  return response.data;
}

export async function getAdminAnalytics(period = {}) {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/admin/platform-analytics",
    params: {
      start_date: period.startDate || undefined,
      end_date: period.endDate || undefined,
    },
  });
  return response.data;
}

export async function getAdminUsers({ q = "", role = "", page = 1, pageSize = 25 } = {}) {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/admin/users",
    params: {
      q: q || undefined,
      role: role || undefined,
      page,
      page_size: pageSize,
    },
  });
  return response.data;
}

export async function getAdminUserDetails(userId) {
  const response = await requestWithFallback({
    method: "GET",
    url: `/api/admin/users/${userId}`,
  });
  return response.data;
}

export async function getAdminRecommendations(period = {}) {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/admin/recommendations",
    params: {
      start_date: period.startDate || undefined,
      end_date: period.endDate || undefined,
    },
  });
  return response.data;
}

export async function updateAdminUserRole(userId, role) {
  const response = await requestWithFallback({
    method: "PUT",
    url: `/api/admin/users/${userId}/role`,
    data: { role },
  });
  return response.data;
}

export async function deleteAdminUser(userId) {
  const response = await requestWithFallback({
    method: "DELETE",
    url: `/api/admin/users/${userId}`,
  });
  return response.data;
}

export async function assignCoachClient(coachId, clientId) {
  const response = await requestWithFallback({
    method: "PUT",
    url: `/api/admin/coaches/${coachId}/clients/${clientId}`,
  });
  return response.data;
}

export async function listCoachAssignments(coachId) {
  const response = await requestWithFallback({
    method: "GET",
    url: `/api/admin/coaches/${coachId}/clients`,
  });
  return response.data;
}

export async function unassignCoachClient(coachId, clientId) {
  const response = await requestWithFallback({
    method: "DELETE",
    url: `/api/admin/coaches/${coachId}/clients/${clientId}`,
  });
  return response.data;
}

export async function assignUnassignedClients() {
  const response = await requestWithFallback({
    method: "POST",
    url: "/api/admin/coaches/assign-unassigned",
  });
  return response.data;
}

export async function downloadAdminReport(format, { startDate, endDate } = {}) {
  const response = await requestWithFallback({
    method: "GET",
    url: `/api/admin/reports/${format}`,
    params: { start_date: startDate || undefined, end_date: endDate || undefined },
    responseType: "blob",
  });
  const extension = format === "pdf" ? "pdf" : "xlsx";
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `platform_analytics.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getSystemHealth() {
  const response = await requestWithFallback({
    method: "GET",
    url: "/api/health",
  });
  return response.data;
}

async function downloadReport(format) {
  const extension = format === "pdf" ? "pdf" : "xlsx";
  const response = await requestWithFallback({
    method: "GET",
    url: `/api/reports/${extension}`,
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `cognitive_alarm_${format}_report.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadUserPerformancePdf() {
  await downloadReport("pdf");
}

export async function downloadUserPerformanceReport() {
  await downloadReport("excel");
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default api;