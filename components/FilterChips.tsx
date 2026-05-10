import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Font } from '@/constants/fonts';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type FilterKey = 'All' | 'Indoor' | 'Outdoor' | 'Open Now' | 'Pet Menu';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Indoor', label: 'Indoor ✓' },
  { key: 'Outdoor', label: 'Outdoor' },
  { key: 'Open Now', label: 'Open Now' },
  { key: 'Pet Menu', label: 'Pet Menu' },
];

type Props = {
  active: FilterKey;
  onSelect: (key: FilterKey) => void;
};

export function FilterChips({ active, onSelect }: Props) {
  const translateY = useSharedValue(80);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 350,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    });
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {FILTERS.map(({ key, label }) => {
          const isActive = active === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onSelect(key)}
              style={[styles.chip, isActive && styles.chipActive]}
              activeOpacity={0.75}
            >
              <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chipActive: {
    backgroundColor: '#0A0A0A',
    borderColor: '#0A0A0A',
  },
  label: {
    fontSize: 14,
    fontFamily: Font.medium,
    color: '#1A1A1A',
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
