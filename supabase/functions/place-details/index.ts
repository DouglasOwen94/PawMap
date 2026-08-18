// Server-side proxy for Google Place Details (rating + opening hours).
//
// Why this exists: Google's Place Details (legacy) API does not send the
// CORS headers a browser requires, so the web build of PawMap can't call
// it directly from client-side JS (see app/(tabs)/index.web.tsx). This
// function runs on Supabase's servers instead — no browser involved, so
// no CORS restriction — and hands the result back to the web app with our
// own CORS headers attached.
//
// Mirrors the shape of lib/places.ts's fetchPlaceDetails() so the native
// app (which calls Google directly, no proxy needed) and the web app stay
// in sync on what a "PlaceDetails" object looks like.
//
// Request:  POST { placeIds: string[] }
// Response: { [placeId]: PlaceDetails | null }

import { corsHeaders } from './_shared/cors.ts';

const API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';
const MAX_PLACE_IDS = 100; // safety cap so one request can't fan out unbounded Google calls

type PlaceDetails = {
  rating: number | null;
  openNow: boolean | null;
  closingTime: string | null;
  weekdayHours: string[] | null;
};

/** Convert a Google Places "HHMM" time string (e.g. "2100") to "9:00 PM". */
function formatTime(hhmm: string): string {
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = hhmm.slice(2);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return m === '00' ? `${hour12}:00 ${suffix}` : `${hour12}:${m} ${suffix}`;
}

async function fetchOne(placeId: string): Promise<PlaceDetails | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,opening_hours&key=${API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const result = json.result ?? {};

    const rating = typeof result.rating === 'number' ? result.rating : null;

    const oh = result.opening_hours ?? null;
    const openNow = oh ? (oh.open_now ?? null) : null;
    const weekdayHours = oh?.weekday_text ?? null;

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

    return { rating, openNow, closingTime, weekdayHours };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { placeIds } = await req.json();
    if (!Array.isArray(placeIds) || placeIds.length === 0) {
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const unique = [...new Set(placeIds)].slice(0, MAX_PLACE_IDS) as string[];
    const results = await Promise.all(unique.map(fetchOne));

    const out: Record<string, PlaceDetails | null> = {};
    unique.forEach((id, i) => {
      out[id] = results[i];
    });

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
