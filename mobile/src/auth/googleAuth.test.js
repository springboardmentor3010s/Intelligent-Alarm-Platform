// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import { isGoogleSignInConfigured, requestGoogleIdToken } from './googleAuth';

const mockPromptAsync = jest.fn();
const mockExchange = jest.fn();

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

jest.mock('expo-auth-session', () => {
  class AuthRequest {
    constructor() {
      this.codeVerifier = 'test-verifier';
    }
    makeAuthUrlAsync() {
      return Promise.resolve('https://accounts.google.com/o/oauth2/v2/auth');
    }
    promptAsync(...args) {
      return mockPromptAsync(...args);
    }
  }
  return {
    AuthRequest,
    ResponseType: { Code: 'code' },
    makeRedirectUri: () => 'cerebrokognit://oauth',
    exchangeCodeAsync: (...args) => mockExchange(...args),
  };
});

const ORIGINAL_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
});

afterAll(() => {
  if (ORIGINAL_CLIENT_ID === undefined) {
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  } else {
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = ORIGINAL_CLIENT_ID;
  }
});

describe('googleAuth', () => {
  it('reports unavailable when no client id is configured', () => {
    expect(isGoogleSignInConfigured()).toBe(false);
  });

  it('returns an error without opening the browser when unconfigured', async () => {
    const result = await requestGoogleIdToken();
    expect(result.success).toBe(false);
    expect(mockPromptAsync).not.toHaveBeenCalled();
  });

  it('returns the id_token on a successful flow', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'mobile-client-123';
    expect(isGoogleSignInConfigured()).toBe(true);
    mockPromptAsync.mockResolvedValue({ type: 'success', params: { code: 'auth-code' } });
    mockExchange.mockResolvedValue({ idToken: 'id-token-abc' });

    const result = await requestGoogleIdToken();
    expect(result).toEqual({ success: true, idToken: 'id-token-abc' });
    expect(mockExchange).toHaveBeenCalled();
  });

  it('treats a dismissed prompt as a cancellation', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'mobile-client-123';
    mockPromptAsync.mockResolvedValue({ type: 'dismiss' });

    const result = await requestGoogleIdToken();
    expect(result.success).toBe(false);
    expect(mockExchange).not.toHaveBeenCalled();
  });
});
