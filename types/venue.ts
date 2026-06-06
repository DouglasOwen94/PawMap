export type CommunityPhoto = {
  id: number;
  venue_id: number;
  photo_url: string;
  created_at: string;
  is_visible: boolean;
};

export type Venue = {
  id: number;
  name: string;
  // Populated client-side by Google Places API — never stored in Supabase
  rating?:       number;
  openNow?:      boolean | null;
  closingTime?:  string | null;
  weekdayHours?: string[] | null;
  city: string;
  neighbourhood: string;
  lat: number | null;
  lng: number | null;
  seating_type: 'indoor' | 'outdoor' | 'both';
  cover_photo_url: string | null;
  indoor_photo_url: string | null;
  last_verified_date: string | null;
  indoor_verified: boolean;
  verifier_id: string | null;
  pet_menu: boolean;
  leash_free: boolean | null;
  dog_sizes_allowed: 'small' | 'medium' | 'large' | 'all';
  hours: Record<string, { open: string; close: string }> | null;
  address: string | null;
  google_place_id: string | null;
  review_url: string | null;
  is_active: boolean;
  status: 'live' | 'pending' | 'expired';
  tags?: string[];
};
