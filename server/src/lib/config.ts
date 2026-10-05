// Settings read from server/.env. Imported at startup, so a missing secret
// stops the server before it accepts requests.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is not set');

export const config = {
  jwtSecret,
  jwtExpiresIn: '1d',
} as const;
