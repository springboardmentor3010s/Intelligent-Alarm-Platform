/**
 * Centralized API configuration module.
 *
 * Reads backend API URL from environment variable VITE_API_URL (configured at build/dev time)
 * and falls back to "http://localhost:8000" for local development.
 *
 * Deployment scenarios:
 * - Local development: uses default "http://localhost:8000" (or VITE_API_URL if defined)
 * - Docker development: uses VITE_API_URL (e.g. http://localhost:8000 accessible from host browser)
 * - Production: uses configured VITE_API_URL or relative path "" if behind reverse proxy
 */

const RAW_API_URL = import.meta.env.VITE_API_URL;

// Ensure no trailing slash so path concatenation like `${API_URL}/alarms` works cleanly
export const API_URL = (RAW_API_URL && RAW_API_URL.trim() !== "")
  ? RAW_API_URL.replace(/\/+$/, "")
  : "http://localhost:8000";

export default API_URL;
