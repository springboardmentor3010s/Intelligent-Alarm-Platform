const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';

export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  return response;
};

export const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

export const parseApiError = async (response) => {
  try {
    const body = await response.json();
    return body.detail || body.message || `Request failed (${response.status})`;
  } catch (e) {
    return `Request failed (${response.status})`;
  }
};