import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Font } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useSavedVenues } from '@/hooks/useSavedVenues';
import { getDogSizeLabel, getSeatingLabel, isExpiredVenue, isIndoorVerified } from '@/utils/venue';
import type { Venue } from '@/types/venue';

type CardProps = {
  venue: Venue;
  onUnsave: (venue: Venue) => void;
};

function SavedVenueCard({ venue, onUnsave }: CardProps) {
  const verified = isIndoorVerified(venue);
  const expired  = isExpiredVenue(venue);

  return (
    <View style={styles.card}>
      <View style={styles.photoArea}>
        <Image
          source={{ uri: venue.cover_photo_url }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={300}
        />
        <TouchableOpacity
          style={styles.heartButton}
          onPress={() => onUnsave(venue)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
        {expired && (
          <View style={styles.badgeRow}>
            <View style={[styles.verifiedDot, { backgroundColor: '#ABABAB' }]} />
            <Text style={[styles.badgeText, { color: '#ABABAB' }]}>Verification Expired</Text>
          </View>
        )}

        <Text style={styles.venueName}>{venue.name}</Text>

        <Text style={styles.venueMeta}>
          {venue.neighbourhood} · {getSeatingLabel(venue.seating_type)}
        </Text>

        <View style={styles.tagsRow}>
          {venue.pet_menu && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>Pet menu</Text>
            </View>
          )}
          <View style={styles.tag}>
            <Text style={styles.tagText}>{getDogSizeLabel(venue.dog_sizes_allowed)}</Text>
          </View>
        </View>
      </View>
    </View>
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

export default function SavedScreen() {
  const { isSaved, toggleSave } = useSavedVenues();
  const [allVenues, setAllVenues] = useState<Venue[]>([]);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('venues')
        .select('*')
        .eq('status', 'live')
        .then(({ data }) => {
          if (data) setAllVenues(data as Venue[]);
        });
    }, [])
  );

  const savedVenues = allVenues.filter(v => isSaved(v.id));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved</Text>
      </View>
      <FlatList
        style={styles.list}
        data={savedVenues}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <SavedVenueCard venue={item} onUnsave={toggleSave} />
        )}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={[
          styles.listContent,
          savedVenues.length === 0 && styles.listContentEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  tagText: {
    fontSize: 12,
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
});
