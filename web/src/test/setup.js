import '@testing-library/jest-dom/vitest';

let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { store = {}; },
  key: (i) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
};