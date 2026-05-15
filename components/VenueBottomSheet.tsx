import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Font } from '@/constants/fonts';

import { getDogSizeLabel, getSeatingLabel, getVerificationText, isExpiredVenue, isIndoorVerified } from '@/utils/venue';
import type { Venue } from '@/types/venue';

type Props = {
  venue: Venue | null;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: (venue: Venue) => void;
};

export function VenueBottomSheet({ venue, onClose, isSaved, onToggleSave }: Props) {
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
  const SCREEN_W = Dimensions.get('window').width;

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
            {/* Photo gallery — swipeable if both cover and indoor photos exist */}
            {(() => {
              const photos = [
                { uri: venue.cover_photo_url, label: null },
                { uri: venue.indoor_photo_url, label: 'Indoor' },
              ].filter(p => !!p.uri) as { uri: string; label: string | null }[];
              return (
                <View style={styles.photoContainer}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={photos.length > 1}
                  >
                    {photos.map((photo, i) => (
                      <View key={i} style={{ width: SCREEN_W, height: 200 }}>
                        <Image
                          source={{ uri: photo.uri }}
                          style={StyleSheet.absoluteFillObject}
                          contentFit="cover"
                          transition={400}
                        />
                        {photo.label && (
                          <View style={styles.photoLabel}>
                            <Text style={styles.photoLabelText}>{photo.label}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                  {photos.length > 1 && (
                    <View style={styles.dotsRow}>
                      {photos.map((_, i) => (
                        <View key={i} style={styles.dot} />
                      ))}
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.heartButton}
                    onPress={() => onToggleSave(venue)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isSaved ? 'heart' : 'heart-outline'}
                      size={20}
                      color={isSaved ? '#EF4444' : '#1A1A1A'}
                    />
                  </TouchableOpacity>
                </View>
              );
            })()}

            <View style={[styles.body, { paddingBottom: insets.bottom + 20 }]}>
              {/* Indoor Verified badge — only shown when all 3 conditions are met */}
              {verified && (
                <View style={styles.badgeRow}>
                  <View style={styles.verifiedDot} />
                  <Text style={styles.badgeText}>Indoor Verified</Text>
                </View>
              )}

              {/* Expired badge — shown when verification has lapsed */}
              {expired && (
                <View style={styles.badgeRow}>
                  <View style={[styles.verifiedDot, { backgroundColor: '#ABABAB' }]} />
                  <Text style={[styles.badgeText, { color: '#ABABAB' }]}>Verification Expired</Text>
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
                {Array.isArray(venue.tags) && venue.tags.map(tag => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
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
  photoLabel: {
    position: 'absolute',
    bottom: 28,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoLabelText: {
    fontSize: 11,
    fontFamily: Font.semiBold,
    color: '#FFFFFF',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  heartButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: Font.semiBold,
    color: '#22C55E',
    letterSpacing: 0.3,
  },

  // Name & meta
  name: {
    fontSize: 20,
    fontFamily: Font.bold,
    color: '#0A0A0A',
  },
  meta: {
    fontSize: 14,
    fontFamily: Font.regular,
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
    fontFamily: Font.regular,
    color: '#6B6B6B',
  },

  // Verification date
  verifiedDate: {
    fontSize: 12,
    fontFamily: Font.regular,
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
    fontFamily: Font.medium,
    color: '#1A1A1A',
  },
});
