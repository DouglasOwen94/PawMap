import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Font } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useSavedVenues } from '@/hooks/useSavedVenues';
import { getSeatingLabel, isIndoorVerified } from '@/utils/venue';
import { SkeletonVenueCard } from '@/components/Skeleton';
import type { Venue } from '@/types/venue';

// Flat light-grey blurhash so cover photos fade in from grey, not white.
const PHOTO_PLACEHOLDER = '00QvwN';

type CardProps = {
  venue: Venue;
  onUnsave: (venue: Venue) => void;
  onPress: (venue: Venue) => void;
};

function SavedVenueCard({ venue, onUnsave, onPress }: CardProps) {
  const verified = isIndoorVerified(venue);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(venue)} activeOpacity={0.88}>
      <View style={styles.photoArea}>
        {venue.cover_photo_url ? (
          <Image
            source={{ uri: venue.cover_photo_url }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={300}
            placeholder={{ blurhash: PHOTO_PLACEHOLDER }}
          />
        ) : (
          <View style={styles.photoComingSoon}>
            <Ionicons name="image-outline" size={20} color="#ABABAB" />
            <Text style={styles.photoComingSoonText}>Photo coming soon</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.heartButton}
          onPress={() => onUnsave(venue)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${venue.name} from saved`}
        >
          <Ionicons name="heart" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        {verified && (
          <View style={styles.badgeRow}>
            <View style={styles.verifiedDot} />
            <Text style={styles.badgeText}>Indoor Verified</Text>
          </View>
        )}
        <Text style={styles.venueName}>{venue.name}</Text>
        <Text style={styles.venueMeta}>
          {venue.neighbourhood} · {getSeatingLabel(venue.seating_type)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="heart-outline" size={48} color="#ABABAB" />
      <Text style={styles.emptyTitle}>No saved places yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap the heart on any venue to save it here
      </Text>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="cloud-offline-outline" size={48} color="#ABABAB" />
      <Text style={styles.emptyTitle}>Couldn&apos;t load your places</Text>
      <Text style={styles.emptySubtitle}>Check your connection and try again.</Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={onRetry}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Retry loading saved places"
      >
        <Text style={styles.retryBtnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

function SkeletonList() {
  return (
    <View style={styles.listContent}>
      {[0, 1, 2].map(i => (
        <View key={i} style={i > 0 && styles.separator}>
          <SkeletonVenueCard />
        </View>
      ))}
    </View>
  );
}

export default function SavedScreen() {
  const { isSaved, toggleSave } = useSavedVenues();
  const [allVenues, setAllVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSaved = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from('venues')
      .select('*')
      .eq('status', 'live');
    if (fetchErr || !data) {
      setError(true);
    } else {
      setError(false);
      setAllVenues(data as Venue[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSaved();
    }, [fetchSaved])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSaved();
    setRefreshing(false);
  }, [fetchSaved]);

  function handleRetry() {
    setLoading(true);
    fetchSaved();
  }

  const savedVenues = allVenues.filter(v => isSaved(v.id));

  function handleCardPress(venue: Venue) {
    router.navigate({ pathname: '/(tabs)/', params: { venueId: String(venue.id) } });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved</Text>
      </View>
      {loading ? (
        <SkeletonList />
      ) : error && allVenues.length === 0 ? (
        <View style={[styles.listContent, styles.listContentEmpty]}>
          <ErrorState onRetry={handleRetry} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={savedVenues}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <SavedVenueCard
              venue={item}
              onUnsave={toggleSave}
              onPress={handleCardPress}
            />
          )}
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={[
            styles.listContent,
            savedVenues.length === 0 && styles.listContentEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6B6B6B" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Font.bold,
    color: '#0A0A0A',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 12,
  },

  // Card
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    backgroundColor: '#FFFFFF',
  },
  photoArea: {
    height: 160,
    backgroundColor: '#F7F7F5',
  },
  photoComingSoon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  photoComingSoonText: {
    fontSize: 12,
    fontFamily: Font.medium,
    color: '#ABABAB',
  },
  heartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },

  // Badge
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: Font.semiBold,
    color: '#22C55E',
    letterSpacing: 0.3,
  },

  // Venue info
  venueName: {
    fontSize: 16,
    fontFamily: Font.bold,
    color: '#0A0A0A',
  },
  venueMeta: {
    fontSize: 13,
    fontFamily: Font.regular,
    color: '#6B6B6B',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: Font.semiBold,
    color: '#0A0A0A',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: Font.regular,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryBtnText: {
    fontSize: 14,
    fontFamily: Font.semiBold,
    color: '#FFFFFF',
  },
});
