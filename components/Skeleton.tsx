import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
};

/**
 * A single grey placeholder block with a subtle left-to-right shimmer sweep.
 * Reuse this for any "loading" surface (cards, photo thumbs, etc.).
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const shimmer = useSharedValue(0.4);

  useEffect(() => {
    // Pulse opacity 0.4 → 1 → 0.4 forever — cheap, no layout work.
    shimmer.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: '#E8E8E4' }, animatedStyle, style]}
    />
  );
}

/** Skeleton placeholder shaped like a SavedVenueCard. */
export function SkeletonVenueCard() {
  return (
    <View style={styles.card}>
      <Skeleton height={160} radius={0} />
      <View style={styles.cardBody}>
        <Skeleton width="55%" height={16} />
        <Skeleton width="75%" height={13} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    backgroundColor: '#FFFFFF',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
});
