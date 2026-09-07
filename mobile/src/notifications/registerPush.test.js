import { registerPushToken, acquireAndRegister } from './registerPush';

describe('registerPushToken', () => {
  it('returns not-registered when the token is empty', async () => {
    const apiFetch = jest.fn();
    const res = await registerPushToken({ token: null, apiFetch });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(res.registered).toBe(false);
    expect(res.reason).toBe('no-token');
  });

  it('posts to the P5 register endpoint and returns registered on ok', async () => {
    const apiFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const res = await registerPushToken({
      token: 'ExpoPushToken[abc]',
      apiFetch,
      platform: 'android',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.registered).toBe(true);
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/notifications/register', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ExpoPushToken[abc]', platform: 'android' }),
    });
  });

  it('defaults platform to Platform.OS when not provided', async () => {
    const { Platform } = require('react-native');
    const apiFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await registerPushToken({ token: 'tok', apiFetch });
    const body = JSON.parse(apiFetch.mock.calls[0][1].body);
    expect(['android', 'ios']).toContain(body.platform);
    expect(body.platform).toBe(Platform.OS);
  });

  it('reports not-ok responses as not registered', async () => {
    const apiFetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
    const res = await registerPushToken({ token: 'tok', apiFetch });
    expect(res).toEqual({ registered: false, reason: 'not-ok', status: 400 });
  });
});

describe('acquireAndRegister', () => {
  it('returns expo-go-or-denied when no push token can be acquired', async () => {
    const res = await acquireAndRegister({ apiFetch: jest.fn(), authToken: 't' });
    expect(res.registered).toBe(false);
    expect(res.reason).toBe('expo-go-or-denied');
  });
});