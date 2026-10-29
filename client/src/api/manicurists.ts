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
