import { request } from './client';

/** A service as the search results carry it. */
export type ServiceSummary = {
  id: number;
  name: string;
  durationMin: number;
  priceCents: number;
};

/** One search result: a manicurist with their active services, sorted by name. */
export type ManicuristSummary = {
  id: number;
  name: string;
  city: string;
  imageUrl: string | null;
  services: ServiceSummary[];
};

export type ManicuristSearch = {
  city?: string;
  service?: string;
};

export type SearchResponse = {
  manicurists: ManicuristSummary[];
};

/** An active service on the manicurist's page. */
export type Service = {
  id: number;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
};

/** One working day: `weekday` 0 = Sunday, minutes from midnight in Sofia time. */
export type WorkingHours = {
  weekday: number;
  startMin: number;
  endMin: number;
};

/** The public profile: active services by name, working hours by weekday. `phone` is "" when there is none. */
export type Manicurist = {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  bio: string;
  imageUrl: string | null;
  services: Service[];
  workingHours: WorkingHours[];
};

/** The free start times of one day, as UTC ISO strings. */
export type SlotsResponse = {
  date: string;
  dayOff: boolean;
  slots: string[];
};

/** Searches manicurists by part of the city and of a service name. Only non-empty params are sent. */
export function searchManicurists(
  { city = '', service = '' }: ManicuristSearch,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (city.trim()) params.set('city', city.trim());
  if (service.trim()) params.set('service', service.trim());
  const query = params.toString();
  return request<SearchResponse>(query ? `/manicurists?${query}` : '/manicurists', { signal });
}

/** The public profile. 404 NOT_FOUND for an unknown id. */
export function getManicurist(id: number, signal?: AbortSignal): Promise<{ manicurist: Manicurist }> {
  return request<{ manicurist: Manicurist }>(`/manicurists/${id}`, { signal });
}

/** The free slots of a service on a Sofia date (`YYYY-MM-DD`). */
export function getSlots(id: number, serviceId: number, date: string, signal?: AbortSignal): Promise<SlotsResponse> {
  const params = new URLSearchParams({ serviceId: String(serviceId), date });
  return request<SlotsResponse>(`/manicurists/${id}/slots?${params}`, { signal });
}
