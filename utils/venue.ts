import type { Venue } from '@/types/venue';

export const MS_PER_DAY = 86_400_000;
export const EXPIRY_DAYS = 90;
export const VERIFIED_DAYS = 60;

export function isExpiredVenue(venue: Venue): boolean {
  if (venue.status === 'expired') return true;
  if (!venue.last_verified_date) return true;
  const age = (Date.now() - new Date(venue.last_verified_date).getTime()) / MS_PER_DAY;
  return age > EXPIRY_DAYS;
}

export function isIndoorVerified(venue: Venue): boolean {
  if (!venue.indoor_verified || !venue.indoor_photo_url || !venue.last_verified_date) return false;
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

export function getPinColor(venue: Venue): string {
  if (isExpiredVenue(venue)) return '#ABABAB';
  if (isIndoorVerified(venue)) return '#22C55E';
  return '#F97316';
}
