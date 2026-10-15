import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, clearSession, getStoredUser, getToken, saveSession } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [checking, setChecking] = useState(Boolean(getToken()));

  // Confirm the saved login is still valid when the app opens.
  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    apiFetch("/auth/me")
      .then((me) => {
        setUser(me);
        saveSession(getToken(), me);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    saveSession(data.access_token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (fields) => {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: fields,
      auth: false,
    });
    saveSession(data.access_token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  // Used after "Continue with Google" returns a token.
  const loginWithToken = useCallback(async (token) => {
    saveSession(token, null);
    const me = await apiFetch("/auth/me");
    saveSession(token, me);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await apiFetch("/auth/me");
    saveSession(getToken(), me);
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, checking, login, register, loginWithToken, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homePathFor(user) {
  if (user?.role === "admin") return "/admin";
  if (user?.role === "coach") return "/coach";
  return "/dashboard";
}
