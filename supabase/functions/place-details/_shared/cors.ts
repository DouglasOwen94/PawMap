// Shared CORS headers for edge functions the web app calls directly from
// the browser. Google's own Place Details endpoint blocks browser calls
// (see place-details/index.ts) — this is what lets *our* function be
// called from the browser instead, since we control these headers.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
