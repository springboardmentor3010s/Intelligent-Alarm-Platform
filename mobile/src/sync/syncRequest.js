// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/**
 * Thin adapter turning apiFetch responses into plain data for the sync engine.
 */
import { apiFetch } from '../utils/api';

export async function syncRequest(endpoint, options = {}) {
  const response = await apiFetch(endpoint, options);
  let body = null;
  try {
    body = response.ok || response.status < 500 ? await response.json() : null;
  } catch {
    body = null;
  }
  if (response && response.ok !== undefined && !response.ok && response.status < 500 && body === null) {
    // non-JSON error; preserve status
    return { ok: false, status: response.status, detail: `Request failed (${response.status})` };
  }
  return {
    ok: response.ok,
    status: response.status,
    ...body,
  };
}

export default syncRequest;