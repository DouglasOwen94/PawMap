import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Font } from '@/constants/fonts';
import { useSavedVenues } from '@/hooks/useSavedVenues';

export function SavedToast() {
  const { toastMessage, clearToast } = useSavedVenues();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-12);

  useEffect(() => {
    if (!toastMessage) return;

    translateY.value = -12;
    translateY.value = withTiming(0, { duration: 200 });
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(
        1300,
        withTiming(0, { duration: 300 }, finished => {
          if (finished) runOnJS(clearToast)();
        })
      )
    );
  }, [toastMessage, opacity, translateY, clearToast]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!toastMessage) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { top: insets.top + 12 }, animatedStyle]}
    >
      <Text style={styles.text}>{toastMessage}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 100,
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
    zIndex: 9999,
  },
  text: {
    fontSize: 14,
    fontFamily: Font.medium,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
