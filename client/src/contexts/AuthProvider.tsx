import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { LoginInput, RegisterInput, User } from '../api/auth';
import { ApiError, clearToken, getToken, onUnauthorized, setToken } from '../api/client';
import { AuthContext, type AuthContextValue } from './AuthContext';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);
  // Only a stored token needs the startup /me call.
  const [loading, setLoading] = useState(() => getToken() !== null);

  const signOut = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  // A 401 UNAUTHORIZED on any request sent with a token logs the user out.
  useEffect(() => onUnauthorized(signOut), [signOut]);

  useEffect(() => {
    if (!getToken()) return;
    // Aborted in the cleanup, so a remount (StrictMode, a fast reload) never leaves a second /me running.
    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then(({ user }) => {
        if (!controller.signal.aborted) setUser(user);
      })
      .catch((error: unknown) => {
        // A 401 clears the token; any other error keeps it for the next load.
        if (!controller.signal.aborted && error instanceof ApiError && error.status === 401) signOut();
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [signOut]);

  const signIn = useCallback((response: authApi.AuthResponse) => {
    setToken(response.token);
    setTokenState(response.token);
    setUser(response.user);
  }, []);

  const login = useCallback(
    async (input: LoginInput) => signIn(await authApi.login(input)),
    [signIn],
  );

  const register = useCallback(
    async (input: RegisterInput) => signIn(await authApi.register(input)),
    [signIn],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The token is cleared below even when the server call fails.
    } finally {
      signOut();
    }
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
