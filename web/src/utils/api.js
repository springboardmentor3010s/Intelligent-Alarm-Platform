// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/**
 * Authenticated fetch helper for the web app.
 *
 * Attaches the stored JWT to every request and, on a 401/403 (expired, invalid
 * or revoked token), clears the local session and sends the user back to the
 * login page so they never sit on a broken authed shell.
 */

const LOGIN_PATH = '/auth';

export function sendToLogin() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {
    /* storage unavailable — nothing to clear */
  }
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.href = LOGIN_PATH;
  }
}

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    sendToLogin();
  }
  return res;
}

export default apiFetch;