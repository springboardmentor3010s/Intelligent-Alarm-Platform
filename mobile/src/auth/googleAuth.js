// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/**
 * Google "Continue with Google" for the native app.
 *
 * The device is a public OAuth client (no secret), so we run the Authorization
 * Code + PKCE flow against Google directly and hand the resulting OIDC
 * `id_token` to our backend (`POST /auth/oauth/google/mobile`), which verifies
 * it and issues the app's JWTs. Config-gated by `EXPO_PUBLIC_GOOGLE_CLIENT_ID`:
 * with no client id the feature reports itself unavailable.
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Required so the browser tab can hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export function getGoogleClientId() {
  return (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
}

export function isGoogleSignInConfigured() {
  return Boolean(getGoogleClientId());
}

/**
 * Run the Google PKCE flow and return the OIDC id_token.
 * @returns {Promise<{success: true, idToken: string} | {success: false, error: string}>}
 */
export async function requestGoogleIdToken() {
  const clientId = getGoogleClientId();
  if (!clientId) {
    return { success: false, error: 'Google sign-in is not configured for this build.' };
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'cerebrokognit', path: 'oauth' });
  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ['openid', 'email', 'profile'],
    responseType: AuthSession.ResponseType.Code,
    redirectUri,
    usePKCE: true,
    extraParams: { prompt: 'select_account' },
  });

  await request.makeAuthUrlAsync(GOOGLE_DISCOVERY);
  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type !== 'success' || !result.params?.code) {
    return { success: false, error: 'Google sign-in was cancelled.' };
  }

  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier },
    },
    GOOGLE_DISCOVERY,
  );
  if (!token.idToken) {
    return { success: false, error: 'Google did not return an identity token.' };
  }
  return { success: true, idToken: token.idToken };
}
