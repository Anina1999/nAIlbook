import { createContext } from 'react';
import type { LoginInput, RegisterInput, User } from '../api/auth';

export type AuthContextValue = {
  /** The logged-in user, or null for a guest. */
  user: User | null;
  token: string | null;
  /** True while the startup /me call is pending. */
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
