# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is
A mobile-first map app showing verified pet-friendly cafes and restaurants in Singapore. Users filter by indoor/outdoor seating, open now, and pet menu. Each venue has a professional cover photo and an indoor pet-seating verification photo. The "Indoor Verified" badge only shows if `indoor_verified` is `true` AND `indoor_photo_url` exists AND `last_verified_date` is within 60 days.

---

## Commands
- Start the app (Expo Go on phone): `npx expo start`
- Install a new package: `npx expo install [package-name]` — always use this, never `npm install` for packages
- Install all dependencies fresh: `npm install`

**Preview**: Install "Expo Go" on your phone → run `npx expo start` → scan the QR code. The app hot-reloads on every save.

---

## Tech stack
- **Framework**: React Native + Expo
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Maps**: react-native-maps (Google Maps or Apple Maps with custom desaturated style)
- **Bottom sheet**: `@gorhom/bottom-sheet` — handles snap points and gesture physics natively
- **Font**: `@expo-google-fonts/urbanist` via `expo-font`
- **Backend/database**: Supabase (free tier)
- **Open now / hours**: Google Places API (via `google_place_id` field)
- **Device saves (no login)**: AsyncStorage
- **Auth**: Supabase Auth — Google SSO and Apple Sign In only, no email/password
- **Email alerts**: Resend (Report a Change notifications to founder)
- **Build/deploy**: Expo EAS Build (compiles for App Store + Google Play without local tooling)

---

## Design tokens

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `color-black` | `#0A0A0A` | Primary text, active states, filled buttons |
| `color-dark` | `#1A1A1A` | Map pins, secondary dark |
| `color-mid` | `#6B6B6B` | Secondary text, meta info |
| `color-light` | `#ABABAB` | Placeholder text, inactive nav |
| `color-border` | `#E8E8E4` | Tag pill borders, input borders |
| `color-surface` | `#F7F7F5` | Screen background |
| `color-white` | `#FFFFFF` | Cards, bottom sheet, buttons |
| `color-green` | `#22C55E` | Indoor verified pins, Open status |
| `color-orange` | `#F97316` | Outdoor-only pins |
| `color-red` | `#EF4444` | Closed status |
| `color-blue` | `#2563EB` | User location dot |
| `color-map-land` | `#EDF0EB` | Map background |

### Typography
Font family: **Urbanist** — weights 400/500/600/700/800.

### Key animation
Bottom sheet entrance and filter chip position: `translateY` / `bottom`, **350ms**, easing `cubic-bezier(0.32, 0.72, 0, 1)`. Pin tap scale: 150ms ease.

---

## Screens to build (in order)
- [ ] Map screen (main screen — build this first)
- [ ] Filter chips (All / Indoor ✓ / Outdoor / Open Now / Pet Menu)
- [ ] Venue card bottom sheet
- [ ] Saved screen
- [ ] Add a Place screen (submissions go to pending queue, not live map)
- [ ] Report a Change button (triggers email to founder via Resend)
- [ ] Login screen (Google SSO + Apple Sign In)

---

## Venue data structure (Supabase)
```typescript
type Venue = {
  id: number;
  name: string;
  city: string;               // default: "Singapore" — never hardcode this
  neighbourhood: string;
  lat: number;
  lng: number;
  seating_type: "indoor" | "outdoor" | "both";
  cover_photo_url: string;
  indoor_photo_url: string | null;
  last_verified_date: string | null;
  indoor_verified: boolean;   // true only if last_verified_date is within 60 days
  verifier_id: string;        // who verified — supports future community verifier team
  pet_menu: boolean;
  dog_sizes_allowed: "small" | "medium" | "large" | "all";
  hours: Record<string, { open: string; close: string }>;
  google_place_id: string;    // for live open/closed status
  is_active: boolean;
  status: "live" | "pending" | "expired";
};
```

---

## Product decisions

### Map behaviour
- Opens centred on user's current location automatically; request permission with a friendly explanation on first open
- If permission denied, fall back to Singapore-centred default view

### Verification expiry
- After 90 days without re-verification: badge disappears, pin turns greyed out (still listed, non-tappable)
- Venue card must say "Verification expired — last verified [date]"
- Greyed-out pins must **never** show the Indoor Verified badge

### User submissions
- Submissions go to a pending queue in Supabase — NOT live on the map
- Only appear after the founder verifies in person
- Confirmation: "Thanks! We'll verify this in person and add it soon."

### Report a Change
- Every venue card has a Report a Change button — sends email to founder via Resend
- Venue is NOT hidden automatically; founder reviews and decides

### User accounts
- No account needed to browse, report, or submit
- Account required only to save favourites (heart a venue)
- Without login: saves use AsyncStorage (device-local, lost if app deleted)
- With login: favourites sync across devices

### Geography
- v1: Singapore only; v2 targets KL and JB
- `city` field is required on every venue record — never hardcode "Singapore"

---

## Key rules — always follow these
1. Build one screen at a time.
2. Use React Native components only — `View`, `Text`, `ScrollView`, etc. Never HTML tags.
3. Never show the Indoor Verified badge unless `indoor_verified` is `true` AND `indoor_photo_url` exists.
4. `last_verified_date` must always be visible on the venue card — never hidden.
5. Keep components small with one job each.
6. Do not add features not in the build list above — ask first.
7. When in doubt, do less.
8. Every venue record must include a `city` field.

---

## Implementation gotchas
- **Map custom style**: Use a desaturated/minimal map style matching `#EDF0EB` land, `#D6DFE8` water, white roads. Mapbox GL is an alternative to react-native-maps for finer style control.
- **Bottom sheet**: `@gorhom/bottom-sheet` is strongly recommended — handles drag-to-dismiss and snap points far better than custom implementations.
- **Photo loading**: Add skeleton loaders for cover photos — the minimal aesthetic breaks if images flash in.
- **Indoor Verified is the core trust signal**: The green dot + badge must be prominent and visually consistent across all surfaces (map sheet, saved list cards).
- **Filter chip "Indoor ✓"** maps to filter key `"Indoor"` in code.
- **Non-matching pins** when a filter is active: 25% opacity, non-tappable.

---

## About the developer
Beginner with no prior coding background — first app build. When giving instructions:
- Use plain English; explain any technical term before using it
- Break every task into small numbered steps with explanations of what and why
- Warn about anything that might go wrong before it happens
- Provide exact copy-paste terminal commands
- After each task, say what was just built and what to check before moving on
- If multiple approaches exist, pick the simplest and explain why

---

## Files and folders
(Update this section as the project structure takes shape)

## Known issues / gotchas
(Add issues here as you discover them during the build)
