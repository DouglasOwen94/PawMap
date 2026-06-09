import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Font } from '@/constants/fonts';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type FilterKey = 'All' | 'Indoor' | 'Outdoor' | 'Open Now' | 'Pet Menu' | 'Leash-free';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Open Now', label: 'Open Now' },
  { key: 'Indoor', label: 'Indoor' },
  { key: 'Outdoor', label: 'Outdoor' },
  { key: 'Leash-free', label: 'Leash-free' },
  { key: 'Pet Menu', label: 'Pet Menu' },
];

type Props = {
  active: FilterKey[];
  onSelect: (key: FilterKey) => void;
};

export function FilterChips({ active, onSelect }: Props) {
  const translateY = useSharedValue(80);
  const clearProgress = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 350,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    });
  }, [translateY]);

  const showClear = active.length >= 2;

  useEffect(() => {
    clearProgress.value = withTiming(showClear ? 1 : 0, {
      duration: 200,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    });
  }, [showClear]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Grows the slot above the chip row from 0 → 28px; chips never move.
  const clearSlotStyle = useAnimatedStyle(() => ({
    height: clearProgress.value * 28,
    opacity: clearProgress.value,
    overflow: 'hidden',
  }));

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Animated.View style={clearSlotStyle} pointerEvents={showClear ? 'auto' : 'none'}>
        <TouchableOpacity
          onPress={() => onSelect('All')}
          style={styles.clearChip}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
        >
          <Text style={styles.clearLabel}>✕ Clear all</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {FILTERS.map(({ key, label }) => {
          const isActive = key === 'All' ? active.length === 0 : active.includes(key);
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onSelect(key)}
              style={[styles.chip, isActive && styles.chipActive]}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Filter: ${label}`}
              accessibilityState={{ selected: isActive }}
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
    flexDirection: 'row',
    alignItems: 'center',
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
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#0A0A0A',
    borderColor: '#0A0A0A',
  },
  clearChip: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  clearLabel: {
    fontSize: 12,
    fontFamily: Font.medium,
    color: '#EF4444',
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
