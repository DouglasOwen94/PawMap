import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import type { Venue } from '@/types/venue';

type Props = {
  venue: Venue;
  selected: boolean;
};

// Pill: 48 × 24. Tail: 6 × 6 diamond rotated 45°, tip protrudes ~4 px below pill bottom.
//
// SAFE_PAD: react-native-maps' Android marker captures the View into a Bitmap whose pixel
// width comes from `(int) layoutWidth` — a float-to-int truncation in MapMarkerManager.java.
// On non-integer-density devices this drops 1-N pixels off the right edge and clips the
// pill. Wrapping the pill in a slightly larger transparent container moves that loss into
// the buffer instead of onto the pill.
//
// No elevation/shadow: Android draws elevation shadows outside view bounds, which also
// overflows the bitmap canvas. Hairline border gives depth instead.
const PILL_W = 48;
const PILL_H = 24;
const TAIL = 6;
const SAFE_PAD = 4;
const CONTAINER_W = PILL_W + SAFE_PAD * 2; // 56
const CONTAINER_H = PILL_H + TAIL - 2;     // 28: pill + tail tip protrusion

export function MapPin({ venue, selected }: Props) {
  const bubbleBg = selected ? '#0A0A0A' : '#FFFFFF';
  const textColor = selected ? '#FFFFFF' : '#1A1A1A';
  const borderColor = selected ? 'transparent' : 'rgba(0,0,0,0.08)';

  return (
    <View
      style={{ width: CONTAINER_W, height: CONTAINER_H, backgroundColor: 'transparent' }}
      collapsable={false}
    >
      {/* Tail — behind pill so bubble covers the overlap */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: (CONTAINER_W - TAIL) / 2,
          width: TAIL,
          height: TAIL,
          transform: [{ rotate: '45deg' }],
          backgroundColor: bubbleBg,
        }}
      />

      {/* Pill — inset by SAFE_PAD on each horizontal side */}
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
        <Text style={{ fontFamily: Font.medium, fontSize: 14, color: textColor }}>
          {typeof venue.rating === 'number' ? venue.rating.toFixed(1) : '—'}
        </Text>
      </View>
    </View>
  );
}
