// Error codes and their HTTP status. The table in the api-conventions skill
// is the source; add a code there before adding it here.
const STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  SLOT_INVALID: 400,
  SLOT_TAKEN: 409,
  DAY_OFF: 409,
  DAY_HAS_BOOKINGS: 409,
  ALREADY_DAY_OFF: 409,
  NOT_CANCELLABLE: 409,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof STATUS;

// Thrown anywhere in the app; the error handler turns it into
// { error: { code, message, details } }. The message is shown in the UI, so it is in Bulgarian.
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}
