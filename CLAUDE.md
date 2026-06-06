# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is
A mobile-first map app showing verified pet-friendly cafes and restaurants in Singapore. Users filter by indoor/outdoor seating, open now, and pet menu. The "Indoor Verified" badge shows if `indoor_verified` is `true` AND `last_verified_date` is within 60 days (photo not required for badge).

---

## Commands
- Start the app (Expo Go on phone): `npx expo start`
- Install a new package: `npx expo install [package-name]` — always use this, never `npm install` for packages
- Install all dependencies fresh: `npm install`
- Lint: `npm run lint`
- **Admin dashboard** (web, desktop only): open `dashboard/index.html` directly in Chrome — no server needed. Founder prefers this over the raw Supabase table UI.

**Preview**: Install "Expo Go" on your phone → run `npx expo start` → scan the QR code. The app hot-reloads on every save.

---

## Tech stack
- **Framework**: React Native + Expo
- **Routing**: `expo-router` (file-based, same idea as Next.js `app/` directory) ✅ installed
- **Animations**: `react-native-reanimated` + `react-native-gesture-handler` ✅ installed
- **Icons**: `@expo/vector-icons` — SF Symbols on iOS, Material Icons on Android/Web ✅ installed
- **Images**: `expo-image` (use this instead of React Native's built-in `<Image>`) ✅ installed
- **Styling**: NativeWind (Tailwind CSS for React Native) — not yet installed
- **Maps**: react-native-maps (Google Maps or Apple Maps with custom desaturated style) ✅ installed
- **Bottom sheet**: `@gorhom/bottom-sheet` v5 ✅ installed — requires `GestureHandlerRootView` at root (`app/_layout.tsx`)
- **Font**: `@expo-google-fonts/urbanist` via `expo-font` ✅ installed — font names live in `constants/fonts.ts`. Always use `fontFamily: Font.bold` etc. instead of `fontWeight` — custom fonts in React Native require the weight baked into the family name.
- **Backend/database**: Supabase ✅ connected — client in `lib/supabase.ts`, credentials in `.env`
- **Open now / hours**: Google Places API (via `google_place_id` field) — NOT YET BUILT. Place ID is stored but no API call is made yet.
- **Location**: `expo-location` (GPS + permission request) ✅ installed
- **Device saves (no login)**: AsyncStorage ✅ installed — used in `hooks/useSavedVenues.tsx`
- **Auth**: Supabase Auth — Google SSO and Apple Sign In only, no email/password — NOT YET BUILT
- **SVG icons**: `react-native-svg` ✅ installed — tab bar icons in `components/TabIcons.tsx` (requires dev build rebuild to activate on device)
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

## Screens status

- [x] Map screen — live Supabase data, refreshes on tab focus
- [x] Filter chips (All / Open Now / Indoor / Outdoor / Leash-free / Pet Menu) — multi-select, AND logic
- [x] Venue card bottom sheet
- [x] Saved screen — pulls from Supabase, filtered by AsyncStorage saved IDs
- [x] Add a Place screen — submissions go to Supabase as `status: pending`
- [x] Admin dashboard — web-only (`dashboard/index.html`), removed from app nav bar
- [x] Report a Change button — saves to Supabase `change_reports` table, visible in dashboard Reports tab
- [x] Address + Map pin — address shown on venue card; tapping opens Google Maps pin (free deep link, no API key needed)
- [x] Community photos — users upload photos from the venue card; shown as a scrollable strip below founder photos. Photos default to is_visible:false (pending review). Dashboard has a 📸 Photos badge in sidebar showing pending count, with approve/reject per photo, per venue, or bulk. Max 5MB, JPG/PNG/WEBP only.
- [ ] Login screen (Google SSO + Apple Sign In)
- [x] Google Places API integration — Open Now / Closed badge with closing time, expandable weekly hours on venue card, live rating in bottom sheet; Open Now filter uses live data with Supabase hours fallback
- [ ] **TODO (future):** Busy / Moderate / Quiet crowd tags — NOT available via standard Places API (only visible on Google Maps). Needs an unofficial scraper or a different data source. Investigate for v2.

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
  cover_photo_url: string | null;     // null until founder uploads photo
  indoor_photo_url: string | null;
  last_verified_date: string | null;  // null = not yet dated, not the same as expired
  indoor_verified: boolean;
  verifier_id: string | null;
  pet_menu: boolean;
  leash_free: boolean | null;         // null = not set; true = leash-free; false = leash required
  dog_sizes_allowed: "small" | "medium" | "large" | "all";
  hours: Record<string, { open: string; close: string }> | null;  // null until Google Places wired up
  address: string | null;             // full street address, e.g. "78 Moh Guan Terrace, #01-20" — null until added
  google_place_id: string | null;     // stored but not yet used to call any API
  is_active: boolean;
  status: "live" | "pending" | "rejected" | "expired";
  rating?: number;                    // placeholder — wire up from Google Places later
};
```

---

## Community photos data structure (Supabase)
```typescript
type CommunityPhoto = {
  id: number;
  venue_id: number;
  photo_url: string;
  created_at: string;
  is_visible: boolean;  // founder can hide inappropriate photos from dashboard
};
```

---

## Product decisions

### Verification flow
- Founder only approves a venue **after physically visiting** — approval = verified
- On approve: `status → live`, `last_verified_date → today` (auto-set), `indoor_verified` set by founder
- No photo required for the Indoor Verified badge — `indoor_verified: true` + `last_verified_date` within 60 days is enough
- Photos (`cover_photo_url`, `indoor_photo_url`) are added by founder separately after approval

### Verification expiry
- A venue with `last_verified_date = null` is **not expired** — it's just not yet dated (pin shows normally)
- After 90 days since `last_verified_date`: pin goes grey, non-tappable
- Venue card must say "Verification expired — last verified [date]"
- Greyed-out pins must never show the Indoor Verified badge

### Map behaviour
- Opens centred on user's current location automatically; request permission with a friendly explanation on first open
- If permission denied, fall back to Singapore-centred default view
- Venues reload from Supabase every time the Map tab is focused

### User submissions
- Submissions go to Supabase as `status: pending` — NOT live on the map
- Only appear after founder approves in the Admin tab
- Confirmation toast: "Thanks! We'll verify this in person."

### Admin dashboard
- Web-only: open `dashboard/index.html` directly in Chrome — no server needed
- Removed from app nav bar (admin.tsx and admin-approve.tsx deleted)
- Shows all venues (pending / live / rejected) with filter sidebar
- Tapping a venue opens edit panel: Approve & publish, Reject, or Save changes
- `last_verified_date` is auto-stamped to today on approve or save
- Reports tab shows user-submitted change reports; founder marks resolved
- Manage Tags tab for creating/deleting amenity tags
- CSV import for bulk venue upload

### Community Photos
- CTA copy: "Love this place? Share some photos for other pawrents."
- Entry point: "Add a photo" button on the venue bottom sheet
- No login required — keep it frictionless
- Photos upload to Supabase Storage under `community/{venue_id}/` subfolder, saved to `community_photos` table
- Shown as a horizontally scrollable strip on the venue card, below the founder's cover/indoor photos
- All photos visible by default (`is_visible: true`); founder can hide individual photos from the dashboard
- Dashboard: each venue edit panel shows its community photos with a Remove button per photo
- No caption field — photo only, keeps the UX simple

### Report a Change
- Every venue card has a Report a Change button
- User picks a reason (No longer pet-friendly / Permanently closed / Wrong hours / Wrong location / Other) and optional note
- Report saved to Supabase `change_reports` table — visible in dashboard under Reports tab
- Dashboard shows open/resolved status; founder marks resolved manually
- Automation (n8n/Make/Zapier) can watch the table and send a text to founder

### User accounts
- No account needed to browse, report, or submit
- Account required only to save favourites (heart a venue)
- Without login: saves use AsyncStorage (device-local, lost if app deleted) ✅ implemented
- With login: favourites sync across devices (requires auth — not yet built)

### Geography
- v1: Singapore only; v2 targets KL and JB
- `city` field is required on every venue record — never hardcode "Singapore"

### Address & Directions
- `address` is a nullable text field — fill in per venue from the dashboard; existing venues default to null
- Address row on venue card has two elements side by side:
  - **Left**: tappable underlined address text (if set) — opens Google Maps pin view: `https://www.google.com/maps/search/?api=1&query=LAT,LNG`
  - **Right**: "Go now" pill button — always visible (uses lat/lng, works even if address is null)
- Tapping "Go now" shows a native action sheet (iOS) or Alert (Android) with: Google Maps (directions) / Waze (navigation) / Cancel
  - Google Maps: `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`
  - Waze: `https://waze.com/ul?ll=LAT,LNG&navigate=yes`

### Google Place ID
- Stored in Supabase but not yet connected to any API
- Will eventually power: Open Now filter + live ratings
- To find a Place ID: search the venue on Google Maps and use the Place ID Finder tool

---

## Key rules — always follow these
1. Build one screen at a time.
2. Use React Native components only — `View`, `Text`, `ScrollView`, etc. Never HTML tags.
3. Never show the Indoor Verified badge unless `indoor_verified` is `true` AND `last_verified_date` is within 60 days.
4. `last_verified_date` must always be visible on the venue card — never hidden.
5. Keep components small with one job each.
6. Do not add features not in the build list above — ask first.
7. When in doubt, do less.
8. Every venue record must include a `city` field.
9. Always use `SafeAreaView` from `react-native-safe-area-context` (not from `react-native`) with `edges={['top']}` on tab screens.
10. Never use `elevation` on heart/icon buttons — use `borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)'` instead to avoid Android octagon shadow bug.

---

## Supabase RLS policies (venues table)
- `Anyone can read live venues` — SELECT, condition filters to `status = 'live'`
- `Admin can read all venues` — SELECT, condition `true` (allows admin to read pending/live)
- `Public can submit venues` — INSERT
- `Admin can update venues` — UPDATE, condition `true`
- `Admin can delete venues` — DELETE, condition `true`

## Supabase RLS policies (community_photos table)
- `Anyone can read visible community photos` — SELECT, condition: `is_visible = true`
- `Anyone can submit a community photo` — INSERT
- `Admin can manage community photos` — UPDATE + DELETE, condition: `true`

---

## Implementation gotchas
- **Map custom style**: Use a desaturated/minimal map style matching `#EDF0EB` land, `#D6DFE8` water, white roads.
- **Bottom sheet**: `@gorhom/bottom-sheet` is strongly recommended — handles drag-to-dismiss and snap points far better than custom implementations.
- **Photo loading**: Add skeleton loaders for cover photos — the minimal aesthetic breaks if images flash in.
- **Indoor Verified is the core trust signal**: The green dot + badge must be prominent and visually consistent across all surfaces (map sheet, saved list cards).
- **Filter chips** are multi-select (AND logic). "All" clears all active filters. "Indoor" maps to filter key `"Indoor"` in code.
- **Non-matching pins** when a filter is active: 25% opacity, non-tappable.
- **Custom marker Views inside `<Marker>` on Android** need two fixes: `collapsable={false}` on outermost View, and `tracksViewChanges` starts `true` then flips to `false` after first frame via `setTimeout`.
- **Android map style**: `customMapStyle` only works on Android/Google Maps. iOS Apple Maps ignores it — needs `PROVIDER_GOOGLE` + Google Maps iOS API key for parity.
- **`useFocusEffect`**: Use this instead of `useEffect` for data fetching on tab screens so data reloads when switching back to a tab.

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

```
app/
  _layout.tsx              # Root Stack — wraps SavedVenuesProvider
  (tabs)/
    _layout.tsx            # Bottom tab navigator (3 tabs: Map, Saved, Add Place)
    index.tsx              # Map screen — live Supabase venues, filters, bottom sheet
    saved.tsx              # Saved screen — Supabase venues filtered by AsyncStorage IDs
    add-place.tsx          # Submission form → Supabase pending queue
components/
  FilterChips.tsx          # Filter pill row (All / Indoor ✓ / Outdoor / Open Now / Pet Menu)
  MapPin.tsx               # Map marker — white pill with paw icon or rating
  VenueBottomSheet.tsx     # Venue detail sheet (name, tags, verified badge, save button, report modal)
  TabIcons.tsx             # Custom SVG icons for bottom tab bar (Map, Saved, Add Place)
  SavedToast.tsx           # Black pill toast notification (used for save + submission confirm)
  haptic-tab.tsx           # Tab button with iOS haptic feedback
  ui/
    icon-symbol.tsx        # Platform-split icons
constants/
  fonts.ts                 # Font family name constants (Font.bold, Font.medium, etc.)
hooks/
  useSavedVenues.tsx       # Context: saved IDs (AsyncStorage) + toast trigger
lib/
  supabase.ts              # Supabase client (uses EXPO_PUBLIC_* env vars)
types/
  venue.ts                 # Venue type definition
utils/
  venue.ts                 # isExpiredVenue, isIndoorVerified, getPinColor, label helpers
dashboard/
  index.html               # Web admin dashboard — open directly in Chrome
```

---

## Pre-launch checklist (do before submitting to App Store / Google Play)

These are intentionally skipped during development because they break Expo Go. Do them all together as a final step before the first EAS production build.

### Google Maps API key — add app restrictions
Currently: Application restrictions = None (fine for dev, unsafe for production)

1. Go to Google Cloud Console → APIs & Services → Credentials → your Maps API key
2. Under **Application restrictions**, select **Android apps**
   - Add your Android package name (from `app.json` → `android.package`)
   - Add your SHA-1 certificate fingerprint (from EAS Build → your keystore)
3. Also add **iOS apps**
   - Add your iOS bundle identifier (from `app.json` → `ios.bundleIdentifier`)
4. API restrictions are already set correctly: Maps SDK for Android, Maps SDK for iOS, Places API

**Why it's skipped during dev**: Adding app restrictions locks the key to your app's bundle ID. Expo Go uses its own bundle ID, so the map breaks in development. Safe to add only once you're doing production EAS builds.

### EAS Build setup
- Run `eas build:configure` to generate `eas.json`
- Set `android.package` and `ios.bundleIdentifier` in `app.json` before first build
- After first Android build, retrieve the SHA-1 fingerprint from EAS and add it to the Google Maps API key restriction above
