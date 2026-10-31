// Settings read from server/.env. Imported at startup, so a missing secret
// stops the server before it accepts requests.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is not set');

// Which geocoder finds the studio coordinates: the real Nominatim, or the fake
// that the tests and the E2E server use, so they never call the network.
const GEOCODERS = ['nominatim', 'fake'] as const;
type GeocoderName = (typeof GEOCODERS)[number];

const geocoder = (process.env.GEOCODER || 'nominatim') as GeocoderName;
if (!GEOCODERS.includes(geocoder)) throw new Error(`GEOCODER must be one of: ${GEOCODERS.join(', ')}`);

export const config = {
  jwtSecret,
  jwtExpiresIn: '1d',
  geocoder,
  // Nominatim's usage policy asks for a User-Agent that identifies the app.
  nominatimUserAgent: process.env.NOMINATIM_USER_AGENT || 'nAIlbook (https://github.com/Anina1999/nAIlbook)',
} as const;
