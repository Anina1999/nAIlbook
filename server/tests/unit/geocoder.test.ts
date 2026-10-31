// The geocoder without the network: the Nominatim implementation gets a
// stubbed fetch, and geocode() runs the fake (GEOCODER=fake in vitest.config.ts).
// Only setTimeout, clearTimeout and Date are faked, so the queue and the
// timeout must use them; promises and Response bodies run as usual.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors.js';
import { createNominatimGeocoder, geocode } from '../../src/lib/geocoder.js';

const USER_AGENT = 'nAIlbook-test (https://example.com/test)';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const found = (lat = '42.6977', lon = '23.3219') => json([{ lat, lon, display_name: 'Тестов адрес' }]);
const notFound = () => json([]);

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

function setup(answer: (call: number) => Response | Promise<Response> = () => found()) {
  const times: number[] = [];
  const fetchStub: FetchStub = vi.fn<typeof fetch>(async () => {
    times.push(Date.now());
    return answer(times.length);
  });
  const lookup = createNominatimGeocoder({ fetch: fetchStub, userAgent: USER_AGENT });
  return { fetchStub, lookup, times };
}

// Runs the timers long enough for one queued request, then returns the result.
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(1000);
  return promise;
}

const unavailable = { code: 'GEOCODER_UNAVAILABLE', status: 503 };

describe('createNominatimGeocoder', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a structured search with the User-Agent', async () => {
    const { fetchStub, lookup } = setup();

    await settle(lookup('ул. Витоша 1', 'София'));

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [input, init] = fetchStub.mock.calls[0];
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      street: 'ул. Витоша 1',
      city: 'София',
      country: 'България',
      format: 'jsonv2',
      limit: '1',
    });
    expect(new Headers(init?.headers).get('User-Agent')).toBe(USER_AGENT);
  });

  it('returns the first result as numbers', async () => {
    const { lookup } = setup(() => found('42.6951', '23.3300'));

    await expect(settle(lookup('ул. Витоша 1', 'София'))).resolves.toEqual({ latitude: 42.6951, longitude: 23.33 });
  });

  it('returns null when nothing is found', async () => {
    const { lookup } = setup(() => notFound());

    await expect(settle(lookup('ул. Никоя 99', 'София'))).resolves.toBeNull();
  });

  it('keeps two waiting requests at least 1000 ms apart', async () => {
    const { fetchStub, lookup, times } = setup();

    const first = lookup('ул. Витоша 1', 'София');
    const second = lookup('ул. Раковски 2', 'София');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchStub).toHaveBeenCalledTimes(2);

    await Promise.all([first, second]);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
  });

  it('waits only for the rest of the 1000 ms after an earlier request', async () => {
    const { fetchStub, lookup, times } = setup();

    const first = lookup('ул. Витоша 1', 'София');
    await vi.advanceTimersByTimeAsync(0);
    await first;
    await vi.advanceTimersByTimeAsync(300);
    const second = lookup('ул. Раковски 2', 'София');
    await vi.advanceTimersByTimeAsync(699);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchStub).toHaveBeenCalledTimes(2);

    await second;
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
  });

  it('serves a second identical lookup from the cache, ignoring case and outer spaces', async () => {
    const { fetchStub, lookup } = setup();

    const first = await settle(lookup('ул. Витоша 1', 'София'));
    const second = await settle(lookup('  УЛ. ВИТОША 1 ', ' софия'));

    expect(second).toEqual(first);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('caches "not found" as well', async () => {
    const { fetchStub, lookup } = setup(() => notFound());

    expect(await settle(lookup('ул. Никоя 99', 'София'))).toBeNull();
    expect(await settle(lookup('ул. Никоя 99', 'София'))).toBeNull();
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('asks again for another address or another city', async () => {
    const { fetchStub, lookup } = setup();

    await settle(lookup('ул. Витоша 1', 'София'));
    await settle(lookup('ул. Витоша 2', 'София'));
    await settle(lookup('ул. Витоша 1', 'Пловдив'));

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['429 Too Many Requests', 429],
    ['500', 500],
    ['403', 403],
  ])('throws GEOCODER_UNAVAILABLE for a %s answer', async (_, status) => {
    const { lookup } = setup(() => json({ error: 'no' }, status));

    const result = lookup('ул. Витоша 1', 'София');
    const assertion = expect(result).rejects.toMatchObject(unavailable);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    await expect(result).rejects.toBeInstanceOf(AppError);
  });

  it('throws GEOCODER_UNAVAILABLE for a network error', async () => {
    const { lookup } = setup(() => {
      throw new TypeError('fetch failed');
    });

    const result = lookup('ул. Витоша 1', 'София');
    const assertion = expect(result).rejects.toMatchObject(unavailable);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('throws GEOCODER_UNAVAILABLE when Nominatim does not answer within 5 s', async () => {
    // Never answers on its own; rejects like fetch does when the signal aborts.
    const fetchStub = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const lookup = createNominatimGeocoder({ fetch: fetchStub, userAgent: USER_AGENT });
    let settled = false;

    const result = lookup('ул. Витоша 1', 'София');
    result.catch(() => {}).finally(() => (settled = true));
    const assertion = expect(result).rejects.toMatchObject(unavailable);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('does not cache a failure, so the next lookup asks again', async () => {
    const { fetchStub, lookup } = setup((call) => (call === 1 ? json({}, 429) : found()));

    const failed = lookup('ул. Витоша 1', 'София');
    const assertion = expect(failed).rejects.toMatchObject(unavailable);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    const retried = await settle(lookup('ул. Витоша 1', 'София'));

    expect(retried).toEqual({ latitude: 42.6977, longitude: 23.3219 });
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});

// Inside Bulgaria, roughly: the fake must return points the map can show.
const inBulgaria = (point: { latitude: number; longitude: number } | null) =>
  point !== null &&
  point.latitude > 41.2 &&
  point.latitude < 44.3 &&
  point.longitude > 22.3 &&
  point.longitude < 28.7;

describe('geocode with GEOCODER=fake', () => {
  it('returns a different point inside Bulgaria for each known city', async () => {
    const cities = ['София', 'Пловдив', 'Велико Търново', 'Варна'];

    const points = await Promise.all(cities.map((city) => geocode('ул. Тестова 1', city)));

    expect(points.every(inBulgaria)).toBe(true);
    expect(new Set(points.map((p) => `${p!.latitude},${p!.longitude}`)).size).toBe(cities.length);
  });

  it('returns the centre of the city whatever the address', async () => {
    expect(await geocode('ул. Витоша 1', 'София')).toEqual(await geocode('бул. България 100', 'София'));
  });

  it('returns a point inside Bulgaria for an unknown city', async () => {
    expect(inBulgaria(await geocode('ул. Тестова 1', 'Непознатоград'))).toBe(true);
  });

  it('returns null for an address containing «ненамерен», in any case', async () => {
    expect(await geocode('ул. ненамерена 5', 'София')).toBeNull();
    expect(await geocode('УЛ. НЕНАМЕРЕНА 5', 'София')).toBeNull();
  });

  it('throws GEOCODER_UNAVAILABLE for an address containing «недостъпен»', async () => {
    await expect(geocode('ул. недостъпен път 3', 'София')).rejects.toMatchObject(unavailable);
  });
});
