// Finds the coordinates of a studio from its address and city. The rest of the
// app calls only geocode(); GEOCODER in config.ts picks the implementation.
import { config } from './config.js';
import { AppError } from './errors.js';

export type Coordinates = { latitude: number; longitude: number };

// null means the address was not found; an unavailable service throws
// GEOCODER_UNAVAILABLE (503).
export type Geocoder = (address: string, city: string) => Promise<Coordinates | null>;

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
// Nominatim's usage policy: at most one request per second.
const MIN_INTERVAL_MS = 1000;
const TIMEOUT_MS = 5000;

function unavailable() {
  return new AppError('GEOCODER_UNAVAILABLE', 'Не успяхме да проверим адреса. Опитайте отново след малко.');
}

const normalise = (text: string) => text.trim().toLocaleLowerCase('bg');

// «ул.», «бул.» and their long forms at the start of the street. OpenStreetMap
// often names the street without them, or as another type («бул.» for «ул.»).
const STREET_TYPE = /^(?:(?:ул|бул)\.\s*|(?:ул|бул|улица|булевард)\s+)/iu;

// The street without its type, or null when it has none (no second request).
function stripStreetType(street: string): string | null {
  if (!STREET_TYPE.test(street)) return null;
  return street.replace(STREET_TYPE, '').trim() || null;
}

// A house number at the end: «4», «4А», «12-14», «3/5». OpenStreetMap often
// has the street but not the house, and with the number Nominatim may return
// only that house in another town.
const HOUSE_NUMBER = /\s+\d[\p{L}\d/-]*$/u;

// The street without its number, or null when it has none (no last request).
function stripHouseNumber(street: string): string | null {
  if (!HOUSE_NUMBER.test(street)) return null;
  return street.replace(HOUSE_NUMBER, '').trim() || null;
}

// The streets to ask for, in order: as typed, without the street type, then
// without the number. Each is asked only when the one before found no match.
function streetsToTry(street: string): string[] {
  const withoutType = stripStreetType(street);
  const withoutNumber = stripHouseNumber(withoutType ?? street);
  return [street, withoutType, withoutNumber].filter((s): s is string => s !== null);
}

// One search result with addressdetails=1.
type NominatimPlace = {
  lat?: unknown;
  lon?: unknown;
  address?: { city?: string; town?: string; village?: string };
};

// A result in another town of the same province (address.state) is not a match.
function inCity(place: NominatimPlace, city: string): boolean {
  const locality = place.address?.city ?? place.address?.town ?? place.address?.village;
  return locality !== undefined && normalise(locality) === normalise(city);
}

type NominatimOptions = { fetch: typeof fetch; userAgent: string };

// The real geocoder. Each instance has its own queue and cache, so a unit test
// can pass a stub fetch and fake timers (setTimeout, clearTimeout and Date).
// Requests run one at a time, at least 1000 ms apart. The first result in the
// given city wins; when none is, the street is asked again without «ул.»/«бул.»
// and then without the house number. Found and not-found answers are cached by city and the original
// address, ignoring case and outer spaces; failures are not, so the next
// lookup asks again.
export function createNominatimGeocoder({ fetch, userAgent }: NominatimOptions): Geocoder {
  const cache = new Map<string, Coordinates | null>();
  let queue: Promise<unknown> = Promise.resolve();
  let lastRequestAt = -Infinity;

  async function search(street: string, city: string): Promise<Coordinates | null> {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();

    const url = new URL(SEARCH_URL);
    url.search = new URLSearchParams({
      street,
      city,
      country: 'България',
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
    }).toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: controller.signal });
      // 429 (rate limited) and every other non-2xx answer.
      if (!response.ok) throw unavailable();
      const results: unknown = await response.json();
      if (!Array.isArray(results)) throw unavailable();
      const match = (results as NominatimPlace[]).find((place) => inCity(place, city));
      if (!match) return null;
      const latitude = Number(match.lat);
      const longitude = Number(match.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw unavailable();
      return { latitude, longitude };
    } catch (err) {
      // A network error, the timeout (an aborted fetch) or an unreadable body.
      if (err instanceof AppError) throw err;
      throw unavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  return (address, city) => {
    const key = `${normalise(city)}\n${normalise(address)}`;
    if (cache.has(key)) return Promise.resolve(cache.get(key)!);

    const run = queue.then(async () => {
      // An identical lookup that waited in the queue may have been answered.
      if (cache.has(key)) return cache.get(key)!;
      let result: Coordinates | null = null;
      for (const street of streetsToTry(address.trim())) {
        result = await search(street, city.trim());
        if (result) break;
      }
      cache.set(key, result);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  };
}

// Centres of the demo cities, for the fake.
const CITY_CENTRES: Record<string, Coordinates> = {
  софия: { latitude: 42.6977, longitude: 23.3219 },
  пловдив: { latitude: 42.1354, longitude: 24.7453 },
  'велико търново': { latitude: 43.0757, longitude: 25.6172 },
  варна: { latitude: 43.2141, longitude: 27.9147 },
  бургас: { latitude: 42.5048, longitude: 27.4626 },
};
const BULGARIA_CENTRE: Coordinates = { latitude: 42.7339, longitude: 25.4858 };

// The fake for tests and the E2E server: the centre of a known city, else the
// centre of Bulgaria. Two words in the address simulate the failures:
// «ненамерен» means not found, «недостъпен» means the service is unavailable.
export const fakeGeocoder: Geocoder = async (address, city) => {
  const text = normalise(address);
  if (text.includes('недостъпен')) throw unavailable();
  if (text.includes('ненамерен')) return null;
  return CITY_CENTRES[normalise(city)] ?? BULGARIA_CENTRE;
};

const geocoder: Geocoder =
  config.geocoder === 'fake'
    ? fakeGeocoder
    : createNominatimGeocoder({ fetch: globalThis.fetch, userAgent: config.nominatimUserAgent });

export function geocode(address: string, city: string): Promise<Coordinates | null> {
  return geocoder(address, city);
}
