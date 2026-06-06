import type { Venue } from '@/types/venue';

export const MS_PER_DAY = 86_400_000;
export const EXPIRY_DAYS = 90;
export const VERIFIED_DAYS = 60;

export function isExpiredVenue(venue: Venue): boolean {
  if (venue.status === 'expired') return true;
  if (!venue.last_verified_date) return false;
  const age = (Date.now() - new Date(venue.last_verified_date).getTime()) / MS_PER_DAY;
  return age > EXPIRY_DAYS;
}

export function isIndoorVerified(venue: Venue): boolean {
  if (!venue.indoor_verified || !venue.last_verified_date) return false;
  const age = (Date.now() - new Date(venue.last_verified_date).getTime()) / MS_PER_DAY;
  return age <= VERIFIED_DAYS;
}

export function getVerificationText(venue: Venue): string {
  if (!venue.last_verified_date) return 'Not yet verified';
  const date = new Date(venue.last_verified_date).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (isExpiredVenue(venue)) return `Verification expired — last verified ${date}`;
  return `Verified ${date}`;
}

export function getSeatingLabel(type: Venue['seating_type']): string {
  switch (type) {
    case 'indoor':  return 'Indoor';
    case 'outdoor': return 'Outdoor';
    case 'both':    return 'Indoor & Outdoor';
  }
}

export function getDogSizeLabel(size: Venue['dog_sizes_allowed']): string {
  switch (size) {
    case 'small':  return 'Small dogs only';
    case 'medium': return 'Small & medium dogs';
    case 'large':  return 'Up to large dogs';
    case 'all':    return 'All sizes welcome';
  }
}

type OpenStatus =
  | { status: 'open';    label: string; color: string }
  | { status: 'closed';  label: string; color: string }
  | { status: 'unknown' };

/**
 * Returns the live open/closed status for a venue using Google Places data.
 * Returns `{ status: 'unknown' }` when no Places data is available.
 */
export function getOpenStatus(venue: Venue): OpenStatus {
  if (venue.openNow == null) return { status: 'unknown' };
  if (venue.openNow) {
    const label = venue.closingTime ? `Open · Closes ${venue.closingTime}` : 'Open now';
    return { status: 'open', label, color: '#22C55E' };
  }
  return { status: 'closed', label: 'Closed', color: '#EF4444' };
}

export function getPinColor(venue: Venue): string {
  if (isExpiredVenue(venue)) return '#ABABAB';
  if (isIndoorVerified(venue)) return '#22C55E';
  return '#F97316';
}

// Spreads markers that share the same building radially so each pin is visible.
// Venues within THRESHOLD degrees (~30m) are fanned out around their centroid.
const OVERLAP_THRESHOLD = 0.0003;
const SPREAD_RADIUS = 0.00022;

export function buildMarkerPositions(
  venues: Venue[]
): Map<number, { latitude: number; longitude: number }> {
  const positions = new Map<number, { latitude: number; longitude: number }>();
  const used = new Set<number>();

  venues.forEach(v => {
    if (!v.lat || !v.lng || used.has(v.id)) return;
    const group: Venue[] = [v];
    used.add(v.id);
    venues.forEach(u => {
      if (used.has(u.id) || !u.lat || !u.lng) return;
      if (
        Math.abs(v.lat - u.lat) < OVERLAP_THRESHOLD &&
        Math.abs(v.lng - u.lng) < OVERLAP_THRESHOLD
      ) {
        group.push(u);
        used.add(u.id);
      }
    });
    if (group.length === 1) {
      positions.set(v.id, { latitude: v.lat, longitude: v.lng });
    } else {
      const clat = group.reduce((s, x) => s + x.lat, 0) / group.length;
      const clng = group.reduce((s, x) => s + x.lng, 0) / group.length;
      group.forEach((u, i) => {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
        positions.set(u.id, {
          latitude:  clat + SPREAD_RADIUS * Math.cos(angle),
          longitude: clng + SPREAD_RADIUS * Math.sin(angle),
        });
      });
    }
  });

  return positions;
}
