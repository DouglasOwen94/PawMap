const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — open_now goes stale

export type PlaceDetails = {
  rating:       number | null;
  openNow:      boolean | null;
  closingTime:  string | null;  // e.g. "9:00 PM" — today's closing time
  weekdayHours: string[] | null; // ["Monday: 8:00 AM – 10:00 PM", ...]
};

type CacheEntry = { data: PlaceDetails; fetchedAt: number };
const cache = new Map<string, CacheEntry>();

/** Convert a Google Places "HHMM" time string (e.g. "2100") to "9:00 PM". */
function formatTime(hhmm: string): string {
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = hhmm.slice(2);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return m === '00' ? `${hour12}:00 ${suffix}` : `${hour12}:${m} ${suffix}`;
}

/**
 * Fetch rating + opening hours for a Google Place.
 * Returns null on network/API failure so callers can degrade gracefully.
 */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const cached = cache.get(placeId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,opening_hours&key=${API_KEY}`;
    const res  = await fetch(url);
    const json = await res.json();
    const result = json.result ?? {};

    const rating = typeof result.rating === 'number' ? result.rating : null;

    const oh = result.opening_hours ?? null;
    const openNow      = oh ? (oh.open_now ?? null) : null;
    const weekdayHours = oh?.weekday_text ?? null;

    // Extract today's closing time from periods
    let closingTime: string | null = null;
    if (oh?.periods) {
      const todayDay = new Date().getDay(); // 0 = Sunday
      const todayPeriod = oh.periods.find(
        (p: { open: { day: number }; close?: { time: string } }) => p.open.day === todayDay
      );
      if (todayPeriod?.close?.time) {
        closingTime = formatTime(todayPeriod.close.time);
      }
    }

    const data: PlaceDetails = { rating, openNow, closingTime, weekdayHours };
    cache.set(placeId, { data, fetchedAt: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/** @deprecated Use fetchPlaceDetails instead */
export async function fetchPlaceRating(placeId: string): Promise<number | null> {
  const details = await fetchPlaceDetails(placeId);
  return details?.rating ?? null;
}
