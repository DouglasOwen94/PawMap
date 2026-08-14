import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import type { Venue } from '@/types/venue';

type Props = {
  venue: Venue;
  selected: boolean;
  isExpired: boolean;
  isSaved: boolean;
};

// SAFE_PAD: react-native-maps on Android captures the marker View into a Bitmap. On New
// Architecture the canvas defaults to 100×100px (old-arch sizing path is bypassed). We patch
// MapMarker.java to use getMeasuredWidth() instead, but keep SAFE_PAD as a transparent buffer
// so any sub-pixel rounding never clips the pill edge.
//
// The saved badge overhangs the pill's top-right corner, and anything outside the measured
// bounds is clipped away by that same Bitmap capture — so the container reserves room for it
// on every pin, saved or not. Padding stays symmetrical to keep the pill centred over the
// coordinate (the marker is anchored bottom-centre), and the pill still sits flush with the
// container's bottom edge so the pin points at exactly the same spot as before.
const PILL_W = 48;
const PILL_H = 24;
const SAFE_PAD = 4;
const BADGE = 14;
const BADGE_OVERHANG = 5;             // how far the badge sticks out past the pill corner
const SIDE_PAD = SAFE_PAD + BADGE_OVERHANG; // 9
const CONTAINER_W = PILL_W + SIDE_PAD * 2;  // 66
const CONTAINER_H = BADGE_OVERHANG + PILL_H; // 29

export function MapPin({ venue, selected, isExpired, isSaved }: Props) {
  const bubbleBg    = selected ? '#0A0A0A' : '#FFFFFF';
  const textColor   = selected ? '#FFFFFF' : '#1A1A1A';
  const borderColor = selected ? 'transparent' : 'rgba(0,0,0,0.08)';
  const opacity     = isExpired && !selected ? 0.3 : 1;

  return (
    <View
      style={{ width: CONTAINER_W, height: CONTAINER_H, backgroundColor: 'transparent', opacity }}
      collapsable={false}
    >
      <View
        style={{
          position: 'absolute',
          top: BADGE_OVERHANG,
          left: SIDE_PAD,
          width: PILL_W,
          height: PILL_H,
          borderRadius: 12,
          borderWidth: 1,
          borderColor,
          backgroundColor: bubbleBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {typeof venue.rating === 'number' ? (
          <Text style={{ fontFamily: Font.medium, fontSize: 14, color: textColor }}>
            {venue.rating.toFixed(1)}
          </Text>
        ) : (
          <Ionicons name="paw" size={14} color={textColor} />
        )}
      </View>

      {isSaved && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: SIDE_PAD + PILL_W - (BADGE - BADGE_OVERHANG),
            width: BADGE,
            height: BADGE,
            borderRadius: BADGE / 2,
            backgroundColor: '#FFFFFF',
            // Border rather than elevation — elevation causes the Android octagon shadow bug.
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="heart" size={8} color="#EF4444" />
        </View>
      )}
    </View>
  );
}
