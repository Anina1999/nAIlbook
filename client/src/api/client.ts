// Typed fetch wrapper. Every call to the server goes through request().

const BASE_URL: string = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'nailbook.token';

const NETWORK_ERROR_MESSAGE = 'Няма връзка със сървъра. Проверете връзката и опитайте отново.';
// Used only when an error response does not carry the { error } shape.
export const UNEXPECTED_ERROR_MESSAGE = 'Нещо се обърка. Опитайте отново.';

/** One issue of a VALIDATION_ERROR: `path` is the field name. */
export type ValidationDetail = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

let unauthorizedHandler: (() => void) | null = null;

/**
 * Registers the handler called when a request sent with a token gets
 * 401 UNAUTHORIZED. Returns a function that removes it.
 */
export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Cancels the request. Only loads pass one; submits are never aborted. */
  signal?: AbortSignal;
};

function isErrorBody(data: unknown): data is { error: { code: string; message: string; details?: unknown } } {
  if (typeof data !== 'object' || data === null || !('error' in data)) return false;
  const { error } = data as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const token = getToken();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // A request we cancelled is not a network failure: its AbortError goes on as it is.
    if (signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch((error: unknown) => {
    // An abort while the body is read keeps its AbortError too.
    if (signal?.aborted) throw error;
    return null;
  });

  if (!res.ok) {
    const error = isErrorBody(data)
      ? new ApiError(res.status, data.error.code, data.error.message, data.error.details)
      : new ApiError(res.status, 'INTERNAL_ERROR', UNEXPECTED_ERROR_MESSAGE);
    if (res.status === 401 && error.code === 'UNAUTHORIZED' && token) unauthorizedHandler?.();
    throw error;
  }

  return data as T;
}

/** The field issues of a VALIDATION_ERROR, or an empty list for any other error. */
export function validationDetails(error: ApiError): ValidationDetail[] {
  if (error.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return [];
  return error.details.filter(
    (d): d is ValidationDetail =>
      typeof d === 'object' &&
      d !== null &&
      typeof (d as { path?: unknown }).path === 'string' &&
      typeof (d as { message?: unknown }).message === 'string',
  );
}
