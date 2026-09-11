import Constants from 'expo-constants';

const bundleHost = () => {
  const uri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
  if (!uri || uri.indexOf(':') === -1) return null;
  const host = uri.split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
};

const host = bundleHost();
const CANDIDATES = [
  host && `http://${host}:8000`,
  host && `http://${host}:8090`,
  process.env.EXPO_PUBLIC_API_URL,
  'http://localhost:8000',
  'http://10.0.2.2:8000',
]
  .filter(Boolean)
  .reduce((acc, v) => (acc.indexOf(v) === -1 ? [...acc, v] : acc), []);

let ACTIVE_BASE = CANDIDATES[0] || 'http://localhost:8000';
let probeIndex = 0;
let probing = null;

const probe = async (base) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'probe@none.invalid', password: 'probe' }),
    });
    return res.status >= 200 && res.status < 500;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const findWorking = async () => {
  for (let i = probeIndex; i < CANDIDATES.length; i++) {
    const base = CANDIDATES[i];
    if (await probe(base)) {
      probeIndex = i;
      return base;
    }
  }
  return null;
};

const resolveBaseUrl = () => {
  if (!probing) {
    probing = (async () => {
      const base = await findWorking();
      if (base) {
        ACTIVE_BASE = base;
        console.log(`[api] backend reachable at ${base}`);
      } else {
        console.warn(`[api] no candidate reachable, falling back to ${CANDIDATES[0]}`);
      }
      probing = null;
      return ACTIVE_BASE;
    })();
  }
  return probing;
};

const skipBrokenCandidate = () => {
  const broken = CANDIDATES.indexOf(ACTIVE_BASE);
  probeIndex = Math.max(probeIndex, broken + 1);
  probing = null;
};

export const apiFetch = async (endpoint, options = {}) => {
  const libUrl = endpoint.startsWith('http');
  const defaultHeaders = { 'Content-Type': 'application/json' };
  for (let attempt = 0; attempt <= CANDIDATES.length; attempt++) {
    const base = await resolveBaseUrl();
    try {
      const response = await fetch(libUrl ? endpoint : `${base}${endpoint}`, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
      });
      if (
        response.status === 401 &&
        !libUrl &&
        !endpoint.startsWith('/api/v1/auth/login')
      ) {
        notifyAuthExpired();
      }
      return response;
    } catch (e) {
      if (options.signal && options.signal.aborted) throw e;
      skipBrokenCandidate();
      if (attempt === CANDIDATES.length) throw e;
      if (!libUrl) console.warn(`[api] ${base} failed, trying next candidate`);
    }
  }
  throw new Error('[api] all backend candidates unreachable');
};

export const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

const authExpiredHandlers = [];

export const onAuthExpired = (handler) => {
  authExpiredHandlers.push(handler);
  return () => {
    const i = authExpiredHandlers.indexOf(handler);
    if (i >= 0) authExpiredHandlers.splice(i, 1);
  };
};

const notifyAuthExpired = () => {
  for (const handler of authExpiredHandlers) {
    try {
      handler();
    } catch (e) {}
  }
};

export const parseApiError = async (response) => {
  try {
    const body = await response.json();
    return body.detail || body.message || `Request failed (${response.status})`;
  } catch (e) {
    return `Request failed (${response.status})`;
  }
};

export const describeFetchError = (error) => {
  const server = ACTIVE_BASE;
  const msg = (error && error.message) || '';
  const name = (error && error.name) || '';
  if (name === 'AbortError' || msg.includes('Aborted')) {
    return `Request timed out after 10s - server (${server}) did not respond.`;
  }
  if (msg.includes('has been canceled')) {
    return `Request was canceled - the server (${server}) did not respond in time. Is the backend running and reachable?`;
  }
  if (
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ERR_CONNECTION_REFUSED')
  ) {
    return `Could not connect to server ${server} (connection refused). Is the backend running and reachable from this emulator/device?`;
  }
  if (msg.includes('ENOTFOUND') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
    return `Server address not found: ${server} (DNS lookup failed).`;
  }
  if (msg) {
    return `Request failed: ${msg} (server: ${server}).`;
  }
  return `Could not reach server ${server}.`;
};