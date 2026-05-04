# Handoff: PawMap SG — Mobile App

## Overview
PawMap SG is a pet-friendly café and restaurant finder for Singapore. This handoff documents the full design for a React Native (or equivalent mobile framework) implementation. The app has three screens: a map view with filterable venue pins, a saved venues list, and an add-place submission form.

---

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing the intended look, feel, and behaviour. They are **not production code to copy directly**.

Your task is to **recreate these designs in your target codebase** (React Native, Expo, Swift, etc.) using its established patterns and libraries. If no framework has been chosen yet, React Native + Expo is recommended.

The prototype (`PawMap.html`) can be opened in any browser for reference. It is fully interactive.

---

## Fidelity
**High-fidelity.** This is a pixel-accurate mockup with final colors, typography, spacing, and interactions defined. Implement it pixel-perfectly using your codebase's component system.

---

## Design Tokens

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `color-black` | `#0A0A0A` | Primary text, active states, filled buttons |
| `color-dark` | `#1A1A1A` | Map pins, secondary dark |
| `color-mid` | `#6B6B6B` | Secondary text, meta info |
| `color-light` | `#ABABAB` | Placeholder text, inactive nav |
| `color-border` | `#E8E8E4` | Tag pill borders, input borders |
| `color-surface` | `#F7F7F5` | Screen background |
| `color-white` | `#FFFFFF` | Cards, bottom sheet, buttons |
| `color-green` | `#22C55E` | Indoor verified pins, Open status, verified dot |
| `color-orange` | `#F97316` | Outdoor-only pins |
| `color-red` | `#EF4444` | Closed status |
| `color-blue` | `#2563EB` | User location dot |
| `color-map-land` | `#EDF0EB` | Map background |
| `color-map-island` | `#E4E9E0` | Singapore island fill |
| `color-map-water` | `#D6DFE8` | Sea/water fill |
| `color-map-green` | `#C8D9C0` | Parks/green patches |

### Typography
| Token | Value |
|-------|-------|
| `font-family` | `Urbanist, system-ui, sans-serif` |
| `font-weight-regular` | `400` |
| `font-weight-medium` | `500` |
| `font-weight-semibold` | `600` |
| `font-weight-bold` | `700` |
| `font-weight-extrabold` | `800` |

### Spacing & Shape
| Token | Value |
|-------|-------|
| `radius-sm` | `12px` |
| `radius-md` | `14px` |
| `radius-lg` | `16px` |
| `radius-xl` | `20px` |
| `radius-pill` | `999px` |
| `radius-full` | `50%` |

### Shadows
| Usage | Value |
|-------|-------|
| Search bar | `0 2px 16px rgba(0,0,0,0.10)` |
| Bottom sheet | `0 -4px 32px rgba(0,0,0,0.18)` |
| Filter chip | `0 2px 8px rgba(0,0,0,0.12)` |
| Saved card | `0 1px 8px rgba(0,0,0,0.07)` |
| Badge | `0 1px 6px rgba(0,0,0,0.12)` |

---

## Screens

---

### 1. Map Screen (default / home)

**Purpose:** Browse a map of Singapore with pet-friendly venue pins. Tap a pin to see venue details in a bottom sheet.

#### Layout
- Full-bleed map fills the entire screen behind all UI
- Search bar floats at the top (absolute positioned, 12px from edges, 10px from top)
- Filter chips scroll horizontally, float above the bottom sheet (or 16px from bottom if no sheet)
- Bottom sheet slides up from the bottom when a pin is tapped
- Bottom nav is always visible at the bottom (56px tall)

#### Search Bar
- Position: absolute, top: 10px, left: 12px, right: 12px
- Height: 44px
- Background: `rgba(255,255,255,0.96)` with `backdrop-filter: blur(8px)`
- Border radius: 14px
- Box shadow: `0 2px 16px rgba(0,0,0,0.10)`
- Left icon: search (magnifier), stroke `#ABABAB`, 16×16
- Text: "Tanjong Pagar, Singapore", font size 14px, color `#6B6B6B`, Urbanist
- Right icon: location/compass, stroke `#ABABAB`, 16×16
- Padding: 0 12px 0 14px; gap between items: 8px

#### Map
- Background: `#EDF0EB` (sage tint)
- Island fill: `#E4E9E0`
- Water: `#D6DFE8`
- Roads: white lines — major roads `1.2px` width, minor roads `0.5px` at 60% opacity
- Green patches: `#C8D9C0` at 60% opacity
- User dot: `#2563EB` circle r=6px with 18% opacity halo r=12px

#### Venue Pins
- Shape: dark pill (`#1A1A1A` fill, selected `#0A0A0A`)
- Colored dot left of label: `#22C55E` indoor, `#F97316` outdoor
- Label: venue name, font size 13–14px, white, Urbanist 500
- Shadow: `rgba(0,0,0,0.08)` shifted 1px down
- Selected: scale 1.15×, fill `#0A0A0A`
- Filtered-out (doesn't match active filter): opacity 0.25, non-tappable
- Tap: opens bottom sheet for that venue

#### Filter Chips
- Chips: `["All", "Indoor ✓", "Outdoor", "Open Now", "Pet Menu"]`
- Horizontally scrollable row, no scrollbar visible
- Chip height: 34px, padding: 0 14px, border-radius: 17px
- **Active chip:** background `#0A0A0A`, text `#FFFFFF`, no border, font-weight 600
- **Inactive chip:** background `rgba(255,255,255,0.92)`, text `#1A1A1A`, border `1px solid rgba(255,255,255,0.30)`, font-weight 400
- All chips: `backdrop-filter: blur(8px)`, box-shadow `0 2px 8px rgba(0,0,0,0.12)`, font-size 13px
- Position: animates up when bottom sheet is open (bottom: ~432px), rests at bottom: 16px when no sheet
- Transition: `bottom 0.35s cubic-bezier(0.32, 0.72, 0, 1)`

---

### 2. Bottom Sheet (Venue Card)

**Purpose:** Show venue details when a pin is tapped. Swipe down or tap outside to dismiss.

#### Container
- Anchored to bottom of the map view (absolute, bottom: 0, left: 0, right: 0)
- Background: `#FFFFFF`
- Border radius: `20px 20px 0 0`
- Box shadow: `0 -4px 32px rgba(0,0,0,0.18)`
- Appears with spring animation: `transform: translateY()` transitioning to 0 with `cubic-bezier(0.32, 0.72, 0, 1)` over 350ms
- Drag down: tracks finger, dismisses if dragged >60px

#### Drag Handle
- Centered, top of sheet: 36×4px rounded rect, `#E0E0E0`, border-radius 2px
- Padding: 10px top

#### Cover Photo
- Margin: 12px 16px 0, border-radius: 14px, overflow hidden
- Height: 190px
- `object-fit: cover`
- **Indoor Verified badge** (indoor venues only): top-left, 10px from edges
  - Background: `rgba(255,255,255,0.95)`, border-radius 20px, padding 4px 10px
  - Green dot 7×7px (`#22C55E`) + "Indoor verified" label, font-size 11.5px, weight 600, color `#1A1A1A`
  - Box shadow: `0 1px 6px rgba(0,0,0,0.12)`
- **Save button**: top-right, 10px from edges
  - 34×34px circle, background `rgba(255,255,255,0.95)`, no border
  - Heart icon: ♡ unfilled / ♥ filled when saved, font-size 17px
  - Box shadow: `0 1px 6px rgba(0,0,0,0.12)`

#### Content (padding: 14px 16px 0)
- **Verified line**: font-size 11.5px, color `#9A9A9A`, weight 400, margin-bottom 6px
  - Indoor: "Verified {N} days ago · indoor photo on file"
  - Outdoor: "Last checked {N} days ago"
- **Venue name**: font-size 20px, weight 700, color `#0A0A0A`, Urbanist, letter-spacing 0.5px, line-height 1.2, margin-bottom 4px
- **Meta row**: flex row, gap 6px, font-size 13px, color `#6B6B6B`, margin-bottom 12px
  - Neighbourhood · Distance away · Open/Closed
  - Open: `#22C55E` weight 600 | Closed: `#EF4444` weight 600
  - Separators (·): color `#D0D0D0`
- **Tag pills**: flex wrap, gap 7px, margin-bottom 16px
  - Height 30px, padding 0 12px, border-radius 15px
  - Border: `1.5px solid #E8E8E4`
  - Background: `#FAFAF9`
  - Font: 12px, weight 500, color `#3A3A3A`

#### Action Buttons
- Two equal-width buttons side by side, gap 10px, padding-bottom 16px
- **Directions** (outline): height 46px, border-radius 12px, border `1.5px solid #1A1A1A`, background `#FFFFFF`, text `#0A0A0A`, font 14px weight 600
  - Press state: background `#F3F3F1`
- **View Indoor Photos** (filled): height 46px, border-radius 12px, no border, background `#0A0A0A`, text `#FFFFFF`, font 14px weight 600
  - Press state: background `#333333`
  - Tapping toggles to an indoor photo gallery view within the sheet (same card, photo area shows gallery placeholder)

---

### 3. Saved Screen

**Purpose:** View all venues the user has saved. Tap a card to jump back to that venue on the map.

#### Layout
- Full-screen scroll view, background `#F7F7F5`
- Header: "Saved", font 22px weight 700, letter-spacing -0.5px, color `#0A0A0A`, padding 16px 16px 4px

#### Empty State
- Centered vertically (paddingTop ~80px)
- 🐾 emoji, font-size 40px
- "No saved venues yet", font 15px weight 500, `#ABABAB`
- Subtext: "Tap the heart on any venue card to save it here", font 13px, `#C0C0C0`, centered, max-width 200px, line-height 1.5

#### Venue Card (saved list)
- Border-radius 16px, overflow hidden, background `#FFFFFF`
- Box shadow: `0 1px 8px rgba(0,0,0,0.07)`
- **Photo**: height 140px, object-fit cover
  - Indoor Verified badge: top-left (same as bottom sheet but slightly smaller — font 10.5px, dot 6px)
  - Unsave button (♥ filled): top-right, 30×30px circle
- **Info row**: padding 12px 14px 14px
  - Venue name: 16px, weight 700, color `#0A0A0A`
  - Neighbourhood · Distance: 12.5px, color `#6B6B6B`, margin-top 3px
- Tap: navigates to Map tab and opens bottom sheet for that venue

---

### 4. Add Place Screen

**Purpose:** User-submitted venue form. Two steps: details → photo upload → success.

#### Header
- "Add a Place", font 22px weight 700
- Subtitle: "Help the community discover pet-friendly spots", font 13px, `#9A9A9A`, line-height 1.5

#### Step 1 — Details Form
- **Text inputs**: height 46px, border-radius 12px, border `1.5px solid #E8E8E4`, padding 0 14px, font 14px
- **Field labels**: font 12px, weight 600, `#6B6B6B`, uppercase, letter-spacing 0.5px, margin-bottom 6px
- **Seating Type toggle**: two equal buttons (Indoor / Outdoor), height 44px, border-radius 12px
  - Selected: background `#0A0A0A`, text `#FFFFFF`, no border
  - Unselected: background `#FFFFFF`, text `#3A3A3A`, border `1.5px solid #E8E8E4`
- **Attribute toggles** (Pet menu, Air-conditioned): same active/inactive style, height 40px, border-radius 20px
- **Continue button**: full width, height 50px, border-radius 14px
  - Active (name filled): background `#0A0A0A`, text `#FFFFFF`, weight 700, font 15px
  - Inactive: background `#E0E0E0`, text `#A0A0A0`, cursor default

#### Step 2 — Photo Upload
- Photo drop zone: full width, height 180px, border-radius 16px, background `#EEEEED`
  - Dashed border `1.5px dashed #D0D0D0`
  - 📷 icon + "Add cover photo" (14px weight 600 `#6B6B6B`) + "Exterior shot works best" (12px `#ABABAB`)
- "Submit for review" button: same style as Continue button
- "← Back" link: font 13px, color `#9A9A9A`

#### Step 3 — Success
- Centered layout, padding 60px 32px
- ✓ in a 64×64 circle, background `#F0FAF5`, font-size 30px
- "Submitted!", font 20px weight 700
- Confirmation message with venue name, font 13.5px, `#9A9A9A`, line-height 1.6
- "Add another place" button: pill shape, height 44px, padding 0 24px, border-radius 22px, `#0A0A0A` fill

---

### 5. Bottom Navigation

- Height: 56px, background `#FFFFFF`, border-top `1px solid #F0F0EE`
- Three equal tabs: **Map** | **Saved** | **Add Place**
- Tab: flex column, icon 22×22px SVG + label
  - Active: color `#0A0A0A`, label weight 600
  - Inactive: color `#AEAEAE`, label weight 400
- Label font: Urbanist, 10.5px, letter-spacing -0.1px
- Saved icon fills solid when active

#### Icons (stroke-based SVGs, strokeWidth 2, strokeLinecap round)
- **Map**: `<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21">` with vertical dividers
- **Saved**: heart path — `M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z` (filled when active)
- **Add Place**: circle with + cross

---

## Data Model

Each venue has the following shape:

```typescript
type Venue = {
  id: number;
  name: string;           // "Strangers' Reunion"
  neighbourhood: string;  // "Tanjong Pagar"
  distance: string;       // "0.3 km"
  isOpen: boolean;
  type: "indoor" | "outdoor";
  verifiedDaysAgo: number;
  tags: string[];         // ["Indoor seating", "Pet menu", "All dog sizes", "Air-conditioned"]
  photo: string;          // URL to cover image
  mapX: number;           // 0–100 coordinate on simplified map
  mapY: number;           // 0–100 coordinate on simplified map
  rating: number;         // 4.6–4.9
};
```

### Seed Venues (5 total)
| Name | Neighbourhood | Type | isOpen | Tags |
|------|--------------|------|--------|------|
| Strangers' Reunion | Tanjong Pagar | indoor | true | Indoor seating, Pet menu, All dog sizes, Air-conditioned |
| Nylon Coffee | Everton Park | indoor | true | Indoor seating, Small dogs only, Air-conditioned |
| The Assembly | Keong Saik | outdoor | false | Outdoor seating, Pet menu, All dog sizes |
| Chye Seng Huat | Lavender | outdoor | true | Outdoor seating, Large dogs welcome, Pet water bowls |
| Forty Hands | Tiong Bahru | indoor | true | Indoor seating, Pet menu, Small & medium dogs, Air-conditioned |

---

## Interactions & Behaviour

### Filter chips → Map pins
- Active filter dims non-matching pins to 25% opacity
- Non-matching pins are non-tappable
- Filter values: `All | Indoor | Outdoor | Open Now | Pet Menu`
- "Indoor ✓" chip maps to filter key `"Indoor"`

### Pin → Bottom Sheet
- Tapping a pin sets it as selected (scale 1.15×, darker fill)
- Bottom sheet slides up from off-screen: `transform: translateY(0)` with spring easing `cubic-bezier(0.32, 0.72, 0, 1)` 350ms
- Filter chips animate up to `bottom: 432px` at same timing
- Tapping backdrop or swiping down >60px dismisses the sheet

### Save / Unsave
- Heart button on venue card and saved list card toggles saved state
- Saved venues persist in local state (use AsyncStorage in production)
- Saved tab shows live count of saved venues

### Saved → Map deep-link
- Tapping a saved venue card navigates to Map tab and opens that venue's bottom sheet

### Add Place — validation
- Continue button is disabled (grey) until `name` field is non-empty

### Indoor Photos toggle
- "View Indoor Photos" button toggles the photo area in the bottom sheet between the cover photo and an indoor gallery placeholder
- Button label changes to "Back to details" when gallery is shown

---

## Animations & Transitions

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Bottom sheet entrance | `translateY` | 350ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Filter chips position | `bottom` | 350ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Bottom sheet drag | `translateY` | none (live) | — |
| Pin tap (scale) | `transform` | 150ms | `ease` |
| Filter chip toggle | `background, color` | 150ms | `ease` |
| Nav tab color | `color` | 150ms | — |
| Button press (outline) | `background` | 120ms | — |

---

## Assets & Photography

Cover photos are sourced from **Unsplash** (placeholder URLs in the prototype). Replace with real venue photography in production. Recommended dimensions: 800×600px minimum, landscape orientation.

| Venue | Unsplash URL used in prototype |
|-------|-------------------------------|
| Strangers' Reunion | `photo-1554118811-1e0d58224f24` |
| Nylon Coffee | `photo-1453614512568-c4024d13c247` |
| The Assembly | `photo-1559925393-8be0ec4767c8` |
| Chye Seng Huat | `photo-1501339847302-ac426a4a7cbb` |
| Forty Hands | `photo-1445116572660-236099ec97a0` |

---

## Map

The prototype uses a simplified SVG illustration of Singapore. In production, integrate a real map SDK:

- **Recommended**: [React Native Maps](https://github.com/react-native-maps/react-native-maps) with Google Maps or Apple Maps
- **Alternative**: Mapbox GL with a custom minimal style (match the `#EDF0EB` map color palette)
- Custom map style should be desaturated/minimal — pale sage land, pale blue water, white roads
- Venue pins should be custom marker components matching the pill design above

---

## Files in This Bundle

| File | Description |
|------|-------------|
| `PawMap.html` | Full interactive prototype — open in browser for reference |
| `README.md` | This document |

---

## Notes for Implementation

1. **Map integration is the most complex part** — budget time for Mapbox/Google Maps custom styling to match the desaturated aesthetic.
2. **Bottom sheet** — consider `@gorhom/bottom-sheet` for React Native, which handles snap points and gesture physics natively.
3. **Typography** — Urbanist is available on Google Fonts. Use `expo-font` or the `@expo-google-fonts/urbanist` package.
4. **Photo loading** — add skeleton loaders for cover photos; the minimal aesthetic breaks if images flash in.
5. **Indoor Verified** — this is PawMap's key trust signal. The green dot + badge should be prominent and consistent across all surfaces.
