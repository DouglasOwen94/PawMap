import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getVerificationText, isExpiredVenue, isIndoorVerified } from '@/utils/venue';
import type { Venue } from '@/types/venue';

function getSeatingLabel(type: Venue['seating_type']): string {
  switch (type) {
    case 'indoor':  return 'Indoor';
    case 'outdoor': return 'Outdoor';
    case 'both':    return 'Indoor & Outdoor';
  }
}

function getDogSizeLabel(size: Venue['dog_sizes_allowed']): string {
  switch (size) {
    case 'small':  return 'Small dogs only';
    case 'medium': return 'Small & medium dogs';
    case 'large':  return 'Up to large dogs';
    case 'all':    return 'All sizes welcome';
  }
}

type Props = {
  venue: Venue | null;
  onClose: () => void;
};

export function VenueBottomSheet({ venue, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['55%'], []);

  useEffect(() => {
    if (venue) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [venue]);

  const insets   = useSafeAreaInsets();
  const verified = venue ? isIndoorVerified(venue) : false;
  const expired  = venue ? isExpiredVenue(venue)    : false;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        {venue && (
          <>
            {/* Cover photo — grey background acts as skeleton while image loads */}
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: venue.cover_photo_url }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={400}
              />
            </View>

            <View style={[styles.body, { paddingBottom: insets.bottom + 20 }]}>
              {/* Indoor Verified badge — only shown when all 3 conditions are met */}
              {verified && (
                <View style={styles.badgeRow}>
                  <View style={styles.verifiedDot} />
                  <Text style={styles.badgeText}>Indoor Verified</Text>
                </View>
              )}

              {/* Venue name */}
              <Text style={styles.name}>{venue.name}</Text>

              {/* Neighbourhood · Seating type */}
              <Text style={styles.meta}>
                {venue.neighbourhood} · {getSeatingLabel(venue.seating_type)}
              </Text>

              {/* Info tags */}
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

              {/* Verification date — always visible per product rules */}
              <Text style={[styles.verifiedDate, expired && styles.expiredText]}>
                {getVerificationText(venue)}
              </Text>

              {/* Report a Change */}
              <TouchableOpacity
                style={styles.reportButton}
                activeOpacity={0.7}
                onPress={() =>
                  Alert.alert('Report a Change', 'Email alerts are coming soon.')
                }
              >
                <Text style={styles.reportButtonText}>Report a Change</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  handle: {
    backgroundColor: '#E8E8E4',
    width: 36,
  },
  content: {
    flex: 1,
  },

  // Photo
  photoContainer: {
    height: 200,
    backgroundColor: '#F7F7F5',
    overflow: 'hidden',
  },

  // Body
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },

  // Indoor Verified badge
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
    fontWeight: '600',
    color: '#22C55E',
    letterSpacing: 0.3,
  },

  // Name & meta
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  meta: {
    fontSize: 14,
    color: '#6B6B6B',
  },

  // Tags
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
    color: '#6B6B6B',
  },

  // Verification date
  verifiedDate: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 2,
  },
  expiredText: {
    color: '#F97316',
  },

  // Report button
  reportButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    alignItems: 'center',
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
});
