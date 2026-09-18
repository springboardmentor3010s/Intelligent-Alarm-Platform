// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import {
  apiFetch,
  parseApiError,
  describeFetchError,
  authHeaders,
  onAuthExpired,
} from '../utils/api';

describe('api surface', () => {
  it('exposes the expected helpers', () => {
    expect(typeof apiFetch).toBe('function');
    expect(typeof parseApiError).toBe('function');
    expect(typeof describeFetchError).toBe('function');
    expect(typeof authHeaders).toBe('function');
    expect(typeof onAuthExpired).toBe('function');
  });

  it('builds the Bearer authorization header', () => {
    expect(authHeaders('abc')).toEqual({ Authorization: 'Bearer abc' });
  });

  it('parses .detail from an error response', async () => {
    const response = { json: async () => ({ detail: 'Invalid credentials' }) };
    await expect(parseApiError(response)).resolves.toBe('Invalid credentials');
  });

  it('falls back to .message when detail is absent', async () => {
    const response = { json: async () => ({ message: 'boom' }) };
    await expect(parseApiError(response)).resolves.toBe('boom');
  });

  it('falls back to an HTTP status message for non-JSON responses', async () => {
    const response = { status: 500, json: async () => { throw new Error('no json'); } };
    await expect(parseApiError(response)).resolves.toBe('Request failed (500)');
  });

  it('registers and unsubscribes auth-expired listeners', () => {
    const handler = jest.fn();
    const unsubscribe = onAuthExpired(handler);
    expect(unsubscribe).toBeInstanceOf(Function);
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe('describeFetchError', () => {
  it('describes a connection refused error with the server', () => {
    const msg = describeFetchError(Object.assign(new Error('ECONNREFUSED'), { name: 'Error' }));
    expect(msg.toLowerCase()).toContain('connection refused');
  });

  it('describes a DNS failure', () => {
    const msg = describeFetchError(Object.assign(new Error('ENOTFOUND'), { name: 'Error' }));
    expect(msg.toLowerCase()).toContain('dns');
  });

  it('describes a timeout', () => {
    const msg = describeFetchError(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    expect(msg.toLowerCase()).toContain('timed out');
  });

  it('emits a raw message fallback', () => {
    const msg = describeFetchError(new Error('something weird'));
    expect(msg).toContain('something weird');
  });

  it('handles a missing error object', () => {
    const msg = describeFetchError(undefined);
    expect(msg).toContain('Could not reach server');
  });
});