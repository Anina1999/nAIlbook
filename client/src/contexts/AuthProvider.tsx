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
    let active = true;
    authApi
      .me()
      .then(({ user }) => {
        if (active) setUser(user);
      })
      .catch((error: unknown) => {
        // A 401 clears the token; any other error keeps it for the next load.
        if (active && error instanceof ApiError && error.status === 401) signOut();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
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
