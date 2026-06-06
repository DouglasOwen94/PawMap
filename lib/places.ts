const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const cache = new Map<string, number | null>();

export async function fetchPlaceRating(placeId: string): Promise<number | null> {
  if (cache.has(placeId)) return cache.get(placeId)!;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating&key=${API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const rating = typeof json.result?.rating === 'number' ? json.result.rating : null;
    cache.set(placeId, rating);
    return rating;
  } catch {
    return null;
  }
}
