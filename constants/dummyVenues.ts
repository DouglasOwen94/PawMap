import type { Venue } from '@/types/venue';

// Today is 2026-05-05.
// Green pin: last_verified_date within 60 days (after 2026-03-06)
// Orange pin: outdoor seating, not indoor-verified
// Grey pin:  last_verified_date older than 90 days (before 2026-02-04) or status 'expired'

const WEEKDAY_HOURS = {
  monday:    { open: '09:00', close: '18:00' },
  tuesday:   { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday:  { open: '09:00', close: '18:00' },
  friday:    { open: '09:00', close: '21:00' },
  saturday:  { open: '10:00', close: '21:00' },
  sunday:    { open: '10:00', close: '17:00' },
};

export const DUMMY_VENUES: Venue[] = [
  {
    // Green pin — indoor verified, verified 25 days ago (within 60-day window)
    id: 1,
    name: 'Tiong Bahru Bakery',
    city: 'Singapore',
    neighbourhood: 'Tiong Bahru',
    lat: 1.2945,
    lng: 103.8284,
    seating_type: 'both',
    cover_photo_url: 'https://placehold.co/600x400',
    indoor_photo_url: 'https://placehold.co/600x400',
    last_verified_date: '2026-04-10',
    indoor_verified: true,
    verifier_id: 'founder-01',
    pet_menu: true,
    dog_sizes_allowed: 'all',
    hours: WEEKDAY_HOURS,
    google_place_id: 'ChIJrTLr-GyuEmsRBfy61i59si0',
    is_active: true,
    status: 'live',
  },
  {
    // Orange pin — outdoor seating only, no indoor verification
    id: 2,
    name: 'Dempsey Hounds',
    city: 'Singapore',
    neighbourhood: 'Dempsey Hill',
    lat: 1.3019,
    lng: 103.8093,
    seating_type: 'outdoor',
    cover_photo_url: 'https://placehold.co/600x400',
    indoor_photo_url: null,
    last_verified_date: '2026-04-01',
    indoor_verified: false,
    verifier_id: 'founder-01',
    pet_menu: true,
    dog_sizes_allowed: 'all',
    hours: WEEKDAY_HOURS,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    is_active: true,
    status: 'live',
  },
  {
    // Grey pin — last verified 171 days ago (> 90-day expiry threshold)
    id: 3,
    name: 'Holland Village Café',
    city: 'Singapore',
    neighbourhood: 'Holland Village',
    lat: 1.3125,
    lng: 103.7961,
    seating_type: 'indoor',
    cover_photo_url: 'https://placehold.co/600x400',
    indoor_photo_url: 'https://placehold.co/600x400',
    last_verified_date: '2025-11-15',
    indoor_verified: false,
    verifier_id: 'founder-01',
    pet_menu: false,
    dog_sizes_allowed: 'small',
    hours: WEEKDAY_HOURS,
    google_place_id: 'ChIJAbC123dEuEmsRXyZ456wvQr',
    is_active: true,
    status: 'expired',
  },
];
