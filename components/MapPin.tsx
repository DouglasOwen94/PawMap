import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import type { Venue } from '@/types/venue';

type Props = {
  venue: Venue;
  selected: boolean;
  isExpired: boolean;
};

// SAFE_PAD: react-native-maps on Android captures the marker View into a Bitmap. On New
// Architecture the canvas defaults to 100×100px (old-arch sizing path is bypassed). We patch
// MapMarker.java to use getMeasuredWidth() instead, but keep SAFE_PAD as a transparent buffer
// so any sub-pixel rounding never clips the pill edge.
const PILL_W = 48;
const PILL_H = 24;
const SAFE_PAD = 4;
const CONTAINER_W = PILL_W + SAFE_PAD * 2; // 56
const CONTAINER_H = PILL_H;               // 24

export function MapPin({ venue, selected, isExpired }: Props) {
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
          top: 0,
          left: SAFE_PAD,
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
    </View>
  );
}
