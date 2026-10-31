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
// One result with addressdetails=1: the locality is in address.city, .town or .village.
type Place = { lat?: string; lon?: string; address?: Record<string, string> };
const place = ({ lat = '42.6977', lon = '23.3219', address = { city: 'София' } }: Place = {}) => ({
  lat,
  lon,
  display_name: 'Тестов адрес',
  address,
});
const found = (lat = '42.6977', lon = '23.3219', city = 'София') => json([place({ lat, lon, address: { city } })]);
const notFound = () => json([]);
// What Nominatim gave for «Христо Смирненски 5», Велико Търново: a street in
// another town of the province (address.state).
const otherTown = () =>
  json([place({ lat: '43.1235', lon: '25.6923', address: { town: 'Горна Оряховица', state: 'Велико Търново' } })]);

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

// The default answer is found in the city the request asked for.
function setup(
  answer: (call: number, url: URL) => Response | Promise<Response> = (_, url) =>
    found(undefined, undefined, url.searchParams.get('city')!),
) {
  const times: number[] = [];
  const fetchStub: FetchStub = vi.fn<typeof fetch>(async (input) => {
    times.push(Date.now());
    return answer(times.length, new URL(String(input)));
  });
  const lookup = createNominatimGeocoder({ fetch: fetchStub, userAgent: USER_AGENT });
  return { fetchStub, lookup, times };
}

// The street sent in each request, in order.
const streets = (fetchStub: FetchStub) =>
  fetchStub.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('street'));

// Runs the timers long enough for the queued requests (one by default), then
// returns the result.
async function settle<T>(promise: Promise<T>, ms = 1000): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
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
      addressdetails: '1',
      limit: '5',
    });
    expect(new Headers(init?.headers).get('User-Agent')).toBe(USER_AGENT);
  });

  it('returns the first result as numbers', async () => {
    const { lookup } = setup(() => found('42.6951', '23.3300'));

    await expect(settle(lookup('ул. Витоша 1', 'София'))).resolves.toEqual({ latitude: 42.6951, longitude: 23.33 });
  });

  it('returns null when nothing is found', async () => {
    const { lookup } = setup(() => notFound());

    // Three requests: as typed, without «ул.», without the number.
    await expect(settle(lookup('ул. Никоя 99', 'София'), 2000)).resolves.toBeNull();
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

    // No «ул.» and no number, so a lookup is one request; the retries have
    // their own cache tests.
    expect(await settle(lookup('Никоя', 'София'))).toBeNull();
    expect(await settle(lookup('Никоя', 'София'))).toBeNull();
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

  describe('the town of the result', () => {
    it('returns null when the only result is in another town of the province', async () => {
      const { lookup } = setup(() => otherTown());

      await expect(settle(lookup('Христо Смирненски 5', 'Велико Търново'))).resolves.toBeNull();
    });

    it('returns null for a result with no city, town or village', async () => {
      const { lookup } = setup(() => json([place({ address: { state: 'Велико Търново', country: 'България' } })]));

      await expect(settle(lookup('Христо Смирненски 5', 'Велико Търново'))).resolves.toBeNull();
    });

    it.each(['city', 'town', 'village'])('accepts the town given in address.%s', async (field) => {
      const { lookup } = setup(() => json([place({ lat: '43.08', lon: '25.63', address: { [field]: 'Велико Търново' } })]));

      await expect(settle(lookup('Христо Ботев 5', 'Велико Търново'))).resolves.toEqual({
        latitude: 43.08,
        longitude: 25.63,
      });
    });

    it('takes the first of several results in the given town, ignoring case and outer spaces', async () => {
      const { lookup } = setup(() =>
        json([
          place({ lat: '43.1235', lon: '25.6923', address: { town: 'Горна Оряховица', state: 'Велико Търново' } }),
          place({ lat: '43.0812', lon: '25.6290', address: { city: 'Велико Търново' } }),
          place({ lat: '43.0700', lon: '25.6100', address: { city: 'Велико Търново' } }),
        ]),
      );

      await expect(settle(lookup('Христо Ботев 5', '  велико търново '))).resolves.toEqual({
        latitude: 43.0812,
        longitude: 25.629,
      });
    });
  });

  describe('the second request without the street type', () => {
    it.each([
      ['nothing was found', notFound],
      ['the result is in another town', otherTown],
    ])('asks again without «ул.» when %s, at least 1000 ms later', async (_, firstAnswer) => {
      const { fetchStub, lookup, times } = setup((call) =>
        call === 1 ? firstAnswer() : found('43.0812', '25.6290', 'Велико Търново'),
      );

      const result = await settle(lookup('ул. Христо Ботев 5', 'Велико Търново'));

      expect(result).toEqual({ latitude: 43.0812, longitude: 25.629 });
      expect(streets(fetchStub)).toEqual(['ул. Христо Ботев 5', 'Христо Ботев 5']);
      expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
    });

    it.each([
      ['ул.Христо Смирненски 5', 'Христо Смирненски 5'],
      ['ул Христо Ботев 5', 'Христо Ботев 5'],
      ['УЛ. Христо Ботев 5', 'Христо Ботев 5'],
      ['улица Христо Ботев 5', 'Христо Ботев 5'],
      ['бул. Витоша 1', 'Витоша 1'],
      ['бул.Витоша 1', 'Витоша 1'],
      ['бул Витоша 1', 'Витоша 1'],
      ['Булевард Витоша 1', 'Витоша 1'],
    ])('removes the street type from «%s»', async (address, stripped) => {
      const { fetchStub, lookup } = setup((call) => (call === 1 ? notFound() : found()));

      await settle(lookup(address, 'София'));

      expect(streets(fetchStub)).toEqual([address, stripped]);
    });

    // The next request after the first one drops only the number.
    it.each([
      ['Христо Ботев 5', 'Христо Ботев'],
      ['Улична 5', 'Улична'],
      ['Булина ливада 3', 'Булина ливада'],
    ])('keeps «%s», which has no street type', async (address, withoutNumber) => {
      const { fetchStub, lookup } = setup(() => notFound());

      await expect(settle(lookup(address, 'София'), 2000)).resolves.toBeNull();
      expect(streets(fetchStub)).toEqual([address, withoutNumber]);
    });

    it('makes only one request when the first one finds the town', async () => {
      const { fetchStub, lookup } = setup();

      await settle(lookup('ул. Витоша 1', 'София'), 2000);

      expect(fetchStub).toHaveBeenCalledTimes(1);
    });

    it('caches the answer of the second request by the original address', async () => {
      const { fetchStub, lookup } = setup((call) => (call === 1 ? notFound() : found()));

      const first = await settle(lookup('ул. Витоша 1', 'София'));
      const second = await settle(lookup('ул. Витоша 1', 'София'));

      expect(second).toEqual(first);
      expect(first).not.toBeNull();
      expect(fetchStub).toHaveBeenCalledTimes(2);
    });

    it('caches "not found" after both requests', async () => {
      const { fetchStub, lookup } = setup(() => notFound());

      // No number, so no third request.
      expect(await settle(lookup('ул. Никоя', 'София'))).toBeNull();
      expect(await settle(lookup('ул. Никоя', 'София'))).toBeNull();
      expect(fetchStub).toHaveBeenCalledTimes(2);
    });

    it('throws GEOCODER_UNAVAILABLE when the second request fails, and does not cache it', async () => {
      const { fetchStub, lookup } = setup((call) => (call === 1 ? notFound() : call === 2 ? json({}, 500) : found()));

      const failed = lookup('ул. Витоша 1', 'София');
      const assertion = expect(failed).rejects.toMatchObject(unavailable);
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
      const retried = await settle(lookup('ул. Витоша 1', 'София'));

      expect(retried).toEqual({ latitude: 42.6977, longitude: 23.3219 });
      expect(fetchStub).toHaveBeenCalledTimes(3);
    });
  });

  describe('the last request without the house number', () => {
    // What Nominatim gave for «Христо Смирненски 4», Велико Търново: house 4
    // exists only in Златарица; the street alone is also in Велико Търново.
    const zlataritsa = () =>
      json([place({ lat: '43.0470', lon: '25.8863', address: { village: 'Златарица', state: 'Велико Търново' } })]);
    const streetInTarnovo = () =>
      json([
        place({ lat: '43.0447', lon: '25.6177', address: { town: 'Дебелец', state: 'Велико Търново' } }),
        place({ lat: '43.0816', lon: '25.6284', address: { city: 'Велико Търново' } }),
      ]);

    it('asks for the street without the number after the request without «ул.», 1000 ms apart', async () => {
      const { fetchStub, lookup, times } = setup((call) =>
        call === 1 ? notFound() : call === 2 ? zlataritsa() : streetInTarnovo(),
      );

      const result = await settle(lookup('ул. Христо Смирненски 4', 'Велико Търново'), 2000);

      expect(result).toEqual({ latitude: 43.0816, longitude: 25.6284 });
      expect(streets(fetchStub)).toEqual(['ул. Христо Смирненски 4', 'Христо Смирненски 4', 'Христо Смирненски']);
      expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
      expect(times[2] - times[1]).toBeGreaterThanOrEqual(1000);
    });

    it('asks for the street without the number second when there is no street type', async () => {
      const { fetchStub, lookup } = setup((call) => (call === 1 ? zlataritsa() : streetInTarnovo()));

      const result = await settle(lookup('Христо Смирненски 4', 'Велико Търново'));

      expect(result).toEqual({ latitude: 43.0816, longitude: 25.6284 });
      expect(streets(fetchStub)).toEqual(['Христо Смирненски 4', 'Христо Смирненски']);
    });

    it.each([
      ['Витоша 4А', 'Витоша'],
      ['Витоша 12-14', 'Витоша'],
      ['Шипка 3/5', 'Шипка'],
      ['6-ти септември 5', '6-ти септември'],
    ])('removes the number from «%s»', async (address, withoutNumber) => {
      const { fetchStub, lookup } = setup((call) => (call === 1 ? notFound() : found()));

      await settle(lookup(address, 'София'));

      expect(streets(fetchStub)).toEqual([address, withoutNumber]);
    });

    it.each(['Христо Ботев', '6-ти септември'])('makes only one request for «%s», which has no type or number', async (address) => {
      const { fetchStub, lookup } = setup(() => notFound());

      await expect(settle(lookup(address, 'София'), 2000)).resolves.toBeNull();
      expect(fetchStub).toHaveBeenCalledTimes(1);
    });

    it('caches the answer of the last request by the original address', async () => {
      const { fetchStub, lookup } = setup((call) => (call < 3 ? notFound() : found()));

      const first = await settle(lookup('ул. Витоша 1', 'София'), 2000);
      const second = await settle(lookup('ул. Витоша 1', 'София'));

      expect(first).toEqual({ latitude: 42.6977, longitude: 23.3219 });
      expect(second).toEqual(first);
      expect(fetchStub).toHaveBeenCalledTimes(3);
    });

    it('caches "not found" after all three requests', async () => {
      const { fetchStub, lookup } = setup(() => notFound());

      expect(await settle(lookup('ул. Никоя 99', 'София'), 2000)).toBeNull();
      expect(await settle(lookup('ул. Никоя 99', 'София'))).toBeNull();
      expect(fetchStub).toHaveBeenCalledTimes(3);
    });

    it('throws GEOCODER_UNAVAILABLE when the last request fails', async () => {
      const { lookup } = setup((call) => (call < 3 ? notFound() : json({}, 500)));

      const failed = lookup('ул. Витоша 1', 'София');
      const assertion = expect(failed).rejects.toMatchObject(unavailable);
      await vi.advanceTimersByTimeAsync(2000);
      await assertion;
    });
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
