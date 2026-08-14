import { Image } from 'expo-image';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Font } from '@/constants/fonts';
import type { StripPhoto } from '@/components/PhotoStrip';

const SCREEN_W = Dimensions.get('window').width;
const PHOTO_H = 200;
// Flat light-grey blurhash so photos fade in from grey, not white.
const PHOTO_PLACEHOLDER = '00QvwN';

/**
 * Web build of the venue photo pager.
 *
 * A plain scrolling element can't work here: gesture-handler captures the
 * touch pointer for the sheet's drag gesture on pointerdown — and re-captures
 * it on every move — which stops the browser from scrolling anything inside
 * the sheet by touch. (That's why a scroll-based strip only came alive once
 * the sheet was fully expanded, the one state where gorhom disables that
 * gesture.) Driving the strip with its own pan gesture sidesteps the browser
 * entirely: it claims horizontal movement, and bows out of vertical movement
 * so upward drags still belong to the sheet.
 */
export function PhotoStrip({ photos }: { photos: StripPhoto[] }) {
  const count = photos.length;
  const index = useSharedValue(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(count > 1)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      startX.value = translateX.value;
    })
    .onUpdate(event => {
      const min = -(count - 1) * SCREEN_W;
      const next = startX.value + event.translationX;
      translateX.value = next < min ? min : next > 0 ? 0 : next;
    })
    .onEnd(event => {
      const threshold = SCREEN_W * 0.2;
      let target = index.value;
      if (event.translationX <= -threshold) {
        target = Math.min(count - 1, index.value + 1);
      } else if (event.translationX >= threshold) {
        target = Math.max(0, index.value - 1);
      }
      index.value = target;
      translateX.value = withTiming(-target * SCREEN_W, {
        duration: 350,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      });
    });

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.strip, { width: SCREEN_W * count }, stripStyle]}>
        {photos.map((photo, i) => (
          <View key={i} style={styles.page}>
            <Image
              source={{ uri: photo.uri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={400}
              placeholder={{ blurhash: PHOTO_PLACEHOLDER }}
            />
            {photo.label && (
              <View style={styles.photoLabel}>
                <Text style={styles.photoLabelText}>{photo.label}</Text>
              </View>
            )}
          </View>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', height: PHOTO_H },
  page: { width: SCREEN_W, height: PHOTO_H },
  photoLabel: {
    position: 'absolute', bottom: 28, left: 12,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  photoLabelText: { fontSize: 11, fontFamily: Font.semiBold, color: '#FFFFFF' },
});
