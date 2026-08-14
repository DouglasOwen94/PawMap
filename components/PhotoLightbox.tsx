import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font } from '@/constants/fonts';
import type { CommunityPhoto } from '@/types/venue';

const SCREEN_W = Dimensions.get('window').width;
// Flat light-grey blurhash so photos fade in from grey, not white.
const PHOTO_PLACEHOLDER = '00QvwN';
const DISMISS_DISTANCE = 120;

type Props = {
  photos: CommunityPhoto[];
  /** Index of the photo to show, or null when closed. */
  index: number | null;
  onClose: () => void;
};

/**
 * Full-screen community photo viewer.
 *
 * Paging and swipe-to-dismiss are both driven by pan gestures rather than a
 * scrolling list. A scroll-based pager can't carry a dismiss gesture on web:
 * gesture-handler captures the touch pointer for any gesture in the tree,
 * which stops the browser scrolling the pager (see PhotoStrip.web.tsx). One
 * gesture per axis, raced against each other, keeps both working everywhere.
 */
export function PhotoLightbox({ photos, index, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const count = photos.length;
  const isOpen = index !== null;
  const [page, setPage] = useState(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const pageValue = useSharedValue(0);

  useEffect(() => {
    if (index === null) return;
    pageValue.value = index;
    translateX.value = -index * SCREEN_W;
    translateY.value = 0;
    setPage(index);
  }, [index, pageValue, translateX, translateY]);

  const pagePan = Gesture.Pan()
    .enabled(count > 1)
    .activeOffsetX([-10, 10])
    .failOffsetY([-20, 20])
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
      let target = pageValue.value;
      if (event.translationX <= -threshold) {
        target = Math.min(count - 1, pageValue.value + 1);
      } else if (event.translationX >= threshold) {
        target = Math.max(0, pageValue.value - 1);
      }
      pageValue.value = target;
      translateX.value = withTiming(-target * SCREEN_W, {
        duration: 300,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      });
      runOnJS(setPage)(target);
    });

  const dismissPan = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .failOffsetX([-20, 20])
    .onUpdate(event => {
      translateY.value = event.translationY;
    })
    .onEnd(event => {
      if (Math.abs(event.translationY) > DISMISS_DISTANCE) {
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const tapToClose = Gesture.Tap().onEnd(() => {
    runOnJS(onClose)();
  });

  const gesture = Gesture.Race(pagePan, dismissPan, tapToClose);

  // Fade the backdrop out as the photo is dragged away, so the dismiss
  // reads as "throwing it off screen" rather than a flat cut.
  const backdropStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateY.value) / (DISMISS_DISTANCE * 2), 1);
    return { opacity: 1 - progress * 0.6 };
  });

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  if (count === 0) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      {/* GestureHandlerRootView is required inside a Modal — the Modal renders
          outside the app's root gesture handler. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]} />

        {isOpen && (
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.strip, { width: SCREEN_W * count }, stripStyle]}>
              {photos.map(photo => (
                <View key={photo.id} style={styles.page}>
                  <Image
                    source={{ uri: photo.photo_url }}
                    style={styles.image}
                    contentFit="contain"
                    transition={200}
                    placeholder={{ blurhash: PHOTO_PLACEHOLDER }}
                  />
                </View>
              ))}
            </Animated.View>
          </GestureDetector>
        )}

        <View style={[styles.topBar, { top: insets.top + 16 }]} pointerEvents="box-none">
          {count > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>{page + 1} / {count}</Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.92)' },
  strip:    { position: 'absolute', top: 0, left: 0, height: '100%', flexDirection: 'row' },
  page:     { width: SCREEN_W, height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 72 },
  image:    { width: '100%', height: '100%' },
  topBar:   { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter:  { backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  counterText: { fontSize: 13, fontFamily: Font.medium, color: '#FFFFFF' },
  close:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
