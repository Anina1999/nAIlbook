import { request } from './client';

export type Role = 'CLIENT' | 'MANICURIST' | 'ADMIN';

export type User = {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: Role;
};

export type LoginInput = {
  email: string;
  password: string;
};

type ContactInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

export type RegisterInput =
  | (ContactInput & { role: 'CLIENT' })
  | (ContactInput & { role: 'MANICURIST'; city: string; address: string; bio?: string });

export type AuthResponse = {
  token: string;
  user: User;
};

export function register(input: RegisterInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', { method: 'POST', body: input });
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: input });
}

export function me(): Promise<{ user: User }> {
  return request<{ user: User }>('/auth/me');
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}
