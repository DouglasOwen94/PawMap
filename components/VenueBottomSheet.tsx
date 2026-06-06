import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Font } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';

import { getDogSizeLabel, getSeatingLabel, getVerificationText, isExpiredVenue, isIndoorVerified } from '@/utils/venue';
import { Skeleton } from '@/components/Skeleton';
import type { Venue, CommunityPhoto } from '@/types/venue';

// Flat light-grey blurhash so photos fade in from grey, not white.
const PHOTO_PLACEHOLDER = '00QvwN';

type Props = {
  venue: Venue | null;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: (venue: Venue) => void;
};

const SCREEN_W = Dimensions.get('window').width;

const REASONS = [
  'No longer pet-friendly',
  'Permanently closed',
  'Wrong hours',
  'Wrong location',
  'Other',
];

const WARNING_KEYWORDS = ['required', 'must', 'not allowed', 'no dogs', 'carrier', 'leash only', 'restricted'];
function isWarningTag(tag: string): boolean {
  const lower = tag.toLowerCase();
  return WARNING_KEYWORDS.some(kw => lower.includes(kw));
}
function hasCarrierTag(tags: string[]): boolean {
  return tags.some(t => t.toLowerCase().includes('carrier'));
}

export function VenueBottomSheet({ venue, onClose, isSaved, onToggleSave }: Props) {
  const sheetRef   = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['65%'], []);

  const [reportVisible, setReportVisible]       = useState(false);
  const [selectedReason, setSelectedReason]     = useState<string | null>(null);
  const [reportNote, setReportNote]             = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted]   = useState(false);
  const [reportError, setReportError]           = useState<string | null>(null);

  const [communityPhotos, setCommunityPhotos] = useState<CommunityPhoto[]>([]);
  const [photosLoading, setPhotosLoading]     = useState(false);
  const [photosError, setPhotosError]         = useState(false);
  const [uploading, setUploading]             = useState(false);
  const [previewIndex, setPreviewIndex]       = useState<number | null>(null);
  const [uploadError, setUploadError]         = useState<string | null>(null);
  const [uploadNotice, setUploadNotice]       = useState<string | null>(null);

  const [directionsVisible, setDirectionsVisible] = useState(false);

  // Report modal animation
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(400)).current;
  const keyboardOffset  = useRef(new Animated.Value(0)).current;

  // Directions modal animation
  const dirOverlayOpacity = useRef(new Animated.Value(0)).current;
  const dirTranslateY     = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      Animated.timing(keyboardOffset, {
        toValue: -e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (venue) {
      sheetRef.current?.snapToIndex(0);
      setPhotosLoading(true);
      setPhotosError(false);
      setCommunityPhotos([]);
      supabase
        .from('community_photos')
        .select('*')
        .eq('venue_id', venue.id)
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error || !data) {
            setPhotosError(true);
          } else {
            setCommunityPhotos(data as CommunityPhoto[]);
          }
          setPhotosLoading(false);
        });
    } else {
      sheetRef.current?.close();
      setCommunityPhotos([]);
      setPhotosError(false);
    }
  }, [venue]);

  const insets   = useSafeAreaInsets();
  const verified = venue ? isIndoorVerified(venue) : false;
  const expired  = venue ? isExpiredVenue(venue)    : false;

  function openReport() {
    setSelectedReason(null);
    setReportNote('');
    setReportSubmitted(false);
    setReportError(null);
    setReportVisible(true);
    overlayOpacity.setValue(0);
    sheetTranslateY.setValue(400);
    keyboardOffset.setValue(0);
    Animated.parallel([
      Animated.timing(overlayOpacity,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(sheetTranslateY, { toValue: 0, damping: 22, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }

  function closeReport() {
    Animated.parallel([
      Animated.timing(overlayOpacity,   { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetTranslateY,  { toValue: 400, duration: 220, useNativeDriver: true }),
    ]).start(() => setReportVisible(false));
  }

  async function handleAddPhoto() {
    if (!venue) return;
    if (communityPhotos.length >= 10) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'To share a photo, allow PawMap to access your photos in Settings.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;

    const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

    const asset = result.assets[0];
    const mime = asset.mimeType ?? '';

    if (!ALLOWED_MIME.includes(mime)) {
      setUploadError('Only JPG, PNG, or WEBP images are allowed.');
      setTimeout(() => setUploadError(null), 3500);
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      setUploadError('Photo is too large (max 5 MB).');
      setTimeout(() => setUploadError(null), 3500);
      return;
    }

    setUploading(true);
    try {
      const ext = mime.split('/')[1];
      const path = `community/${venue.id}/${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      // Belt-and-braces: if fileSize wasn't reported, check the actual bytes
      if (arrayBuffer.byteLength > MAX_PHOTO_BYTES) {
        setUploadError('Photo is too large (max 5 MB).');
        setTimeout(() => setUploadError(null), 3500);
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from('venue-photos')
        .upload(path, arrayBuffer, { contentType: mime });

      if (uploadError) throw new Error(`Storage: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('venue-photos').getPublicUrl(path);
      const { error: dbError } = await supabase
        .from('community_photos')
        .insert({ venue_id: venue.id, photo_url: urlData.publicUrl, is_visible: false });

      if (dbError) throw new Error(`DB: ${dbError.message}`);

      setUploadNotice('Thanks! Your photo will appear after review.');
      setTimeout(() => setUploadNotice(null), 4000);
    } catch {
      setUploadError('Upload failed — please try again.');
      setTimeout(() => setUploadError(null), 3000);
    } finally {
      setUploading(false);
    }
  }

  function openGoogleMaps() {
    if (!venue) return;
    const query = encodeURIComponent(`${venue.name}, ${venue.neighbourhood}, Singapore`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() =>
      Alert.alert("Couldn't open Google Maps", 'Make sure the app or a browser is available on your device.')
    );
  }

  function openWaze() {
    if (!venue) return;
    const query = encodeURIComponent(`${venue.name}, ${venue.neighbourhood}, Singapore`);
    Linking.openURL(`https://waze.com/ul?q=${query}&navigate=yes`).catch(() =>
      Alert.alert("Couldn't open Waze", 'Waze may not be installed on your device.')
    );
  }

  function openReview() {
    if (!venue?.review_url) return;
    Linking.openURL(venue.review_url).catch(() =>
      Alert.alert("Couldn't open link", 'Try copying the link manually or check your internet connection.')
    );
  }

  function openDirections() {
    setDirectionsVisible(true);
    dirOverlayOpacity.setValue(0);
    dirTranslateY.setValue(300);
    Animated.parallel([
      Animated.timing(dirOverlayOpacity, { toValue: 1, duration: 260, useNativeDriver: false }),
      Animated.spring(dirTranslateY, { toValue: 0, damping: 22, stiffness: 220, useNativeDriver: false }),
    ]).start();
  }

  function closeDirections() {
    Animated.parallel([
      Animated.timing(dirOverlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(dirTranslateY, { toValue: 300, duration: 220, useNativeDriver: true }),
    ]).start(() => setDirectionsVisible(false));
  }

  function handleNavigate(openFn: () => void) {
    openFn();
    dirOverlayOpacity.setValue(0);
    dirTranslateY.setValue(300);
    setDirectionsVisible(false);
  }

  async function submitReport() {
    if (!selectedReason || !venue) return;
    setReportSubmitting(true);
    setReportError(null);
    const { error } = await supabase.from('change_reports').insert({
      venue_id: venue.id,
      venue_name: venue.name,
      reason: selectedReason,
      note: reportNote.trim() || null,
    });
    setReportSubmitting(false);
    if (error) {
      // Never show a false "Thanks!" — keep the form open so the report isn't lost.
      setReportError("Couldn't send report — please try again.");
      console.error('[Report] Supabase error:', error.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setReportSubmitted(true);
    setTimeout(closeReport, 2000);
  }

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          {venue && (
            <>
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
                            placeholder={{ blurhash: PHOTO_PLACEHOLDER }}
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
                      accessibilityRole="button"
                      accessibilityLabel={isSaved ? 'Remove from saved' : 'Save venue'}
                      accessibilityState={{ selected: isSaved }}
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

              <View style={styles.body}>
                {/* — Header: badge + name + meta — */}
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
                <Text style={styles.name}>{venue.name}</Text>
                <Text style={styles.meta}>
                  {venue.neighbourhood} · {getSeatingLabel(venue.seating_type)}
                </Text>

                <View style={styles.divider} />

                {/* — Location — */}
                <View style={styles.locationSection}>
                  {venue.address && (
                    <View style={styles.addressTextRow}>
                      <Ionicons name="location-outline" size={13} color="#6B6B6B" />
                      <Text style={styles.address}>{venue.address}</Text>
                    </View>
                  )}
                  <View style={styles.locationBtns}>
                    <TouchableOpacity style={styles.goNowBtn} onPress={openDirections} activeOpacity={0.75}>
                      <Text style={styles.goNowText}>Go now →</Text>
                    </TouchableOpacity>
                    {venue.review_url && (
                      <TouchableOpacity style={styles.watchReviewBtn} onPress={openReview} activeOpacity={0.75}>
                        <Ionicons name="logo-tiktok" size={12} color="#1A1A1A" />
                        <Text style={styles.watchReviewText}>Watch review</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Community photos strip */}
                <View style={styles.communitySection}>
                  <Text style={styles.communityLabel}>From the community</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityRow}>
                    {communityPhotos.length < 10 && (
                      <View style={styles.addPhotoBtnWrapper}>
                        <TouchableOpacity
                          style={styles.addPhotoBtn}
                          onPress={handleAddPhoto}
                          activeOpacity={0.7}
                          disabled={uploading}
                          accessibilityRole="button"
                          accessibilityLabel="Add a photo"
                          accessibilityState={{ busy: uploading, disabled: uploading }}
                        >
                          {uploading
                            ? <ActivityIndicator size="small" color="#6B6B6B" />
                            : <Text style={styles.addPhotoBtnText}>+</Text>}
                        </TouchableOpacity>
                        <Text style={styles.addPhotoHint}>Love this place?{'\n'}Share a photo.</Text>
                      </View>
                    )}
                    {photosLoading
                      ? [0, 1, 2].map(i => (
                          <Skeleton key={i} width={80} height={80} radius={8} />
                        ))
                      : communityPhotos.map((photo, i) => (
                          <TouchableOpacity
                            key={photo.id}
                            onPress={() => setPreviewIndex(i)}
                            activeOpacity={0.85}
                            accessibilityRole="imagebutton"
                            accessibilityLabel="View community photo"
                          >
                            <Image
                              source={{ uri: photo.photo_url }}
                              style={styles.communityThumb}
                              contentFit="cover"
                              transition={300}
                              placeholder={{ blurhash: PHOTO_PLACEHOLDER }}
                            />
                          </TouchableOpacity>
                        ))}
                  </ScrollView>
                  {photosError && (
                    <Text style={styles.uploadErrorText}>Couldn&apos;t load photos.</Text>
                  )}
                  {uploadError && (
                    <Text style={styles.uploadErrorText}>{uploadError}</Text>
                  )}
                  {uploadNotice && (
                    <Text style={styles.uploadNoticeText}>{uploadNotice}</Text>
                  )}
                </View>

                <View style={styles.divider} />

                {/* — Tags — */}
                <Text style={styles.tagsLabel}>What&apos;s here</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
                  {/* Warning tags first */}
                  {venue.leash_free === false && !hasCarrierTag(venue.tags ?? []) && (
                    <View style={styles.tagWarning}><Text style={styles.tagWarningText}>⚠ Leash required</Text></View>
                  )}
                  {Array.isArray(venue.tags) && venue.tags.filter(isWarningTag).map(tag => (
                    <View key={tag} style={styles.tagWarning}><Text style={styles.tagWarningText}>⚠ {tag}</Text></View>
                  ))}
                  {/* Amenity tags after */}
                  {venue.pet_menu && (
                    <View style={styles.tag}><Text style={styles.tagText}>Pet menu</Text></View>
                  )}
                  {venue.leash_free === true && (
                    <View style={styles.tag}><Text style={styles.tagText}>Leash-free</Text></View>
                  )}
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{getDogSizeLabel(venue.dog_sizes_allowed)}</Text>
                  </View>
                  {Array.isArray(venue.tags) && venue.tags.filter(t => !isWarningTag(t)).map(tag => (
                    <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
                  ))}
                </ScrollView>

                <View style={styles.divider} />

                {/* — Footer: verified date + report link — */}
                <Text style={[styles.verifiedDate, expired && styles.expiredText]}>
                  {getVerificationText(venue)}
                </Text>
                <TouchableOpacity style={styles.reportLink} activeOpacity={0.6} onPress={openReport}>
                  <Text style={styles.reportLinkText}>Report a Change</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Full-screen community photo preview */}
      <Modal visible={previewIndex !== null} transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setPreviewIndex(null)} activeOpacity={1} />
          <FlatList
            data={communityPhotos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={previewIndex ?? 0}
            getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_W, alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  source={{ uri: item.photo_url }}
                  style={styles.previewImage}
                  contentFit="cover"
                  transition={200}
                  placeholder={{ blurhash: PHOTO_PLACEHOLDER }}
                />
              </View>
            )}
          />
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setPreviewIndex(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Directions action sheet */}
      <Modal visible={directionsVisible} transparent animationType="none" onRequestClose={() => closeDirections()}>
        <View style={{ flex: 1 }}>
          {/* Dim overlay — visual only, never intercepts taps */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', opacity: dirOverlayOpacity }]} pointerEvents="none" />
          {/* Backdrop tap area — only covers space above the sheet */}
          <TouchableOpacity style={{ flex: 1 }} onPress={() => closeDirections()} activeOpacity={1} />
          {/* Sheet */}
          <Animated.View style={[styles.directionsSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: dirTranslateY }] }]}>
            <Text style={styles.directionsTitle}>Get directions</Text>

            <TouchableOpacity style={styles.directionsOption} onPress={() => handleNavigate(openGoogleMaps)} activeOpacity={0.75}>
              <View style={[styles.directionsIconBox, { backgroundColor: '#EBF3FF' }]}>
                <Ionicons name="map" size={20} color="#2563EB" />
              </View>
              <Text style={styles.directionsOptionText}>Google Maps</Text>
              <Ionicons name="chevron-forward" size={16} color="#ABABAB" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.directionsOption} onPress={() => handleNavigate(openWaze)} activeOpacity={0.75}>
              <View style={[styles.directionsIconBox, { backgroundColor: '#E0F9FA' }]}>
                <Ionicons name="navigate" size={20} color="#00B0BF" />
              </View>
              <Text style={styles.directionsOptionText}>Waze</Text>
              <Ionicons name="chevron-forward" size={16} color="#ABABAB" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.directionsCancel} onPress={() => closeDirections()} activeOpacity={0.7}>
              <Text style={styles.directionsCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={reportVisible}
        transparent
        animationType="none"
        onRequestClose={closeReport}
      >
        {/* Faded overlay — animates independently from the sheet */}
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeReport} activeOpacity={1} />

          <Animated.View
            style={[
              styles.reportSheet,
              { paddingBottom: insets.bottom + 16, transform: [{ translateY: sheetTranslateY }, { translateY: keyboardOffset }] },
            ]}
          >
              {reportSubmitted ? (
                <View style={styles.successContent}>
                  <Text style={styles.successIcon}>✓</Text>
                  <Text style={styles.successText}>Thanks! We&apos;ll check it out.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>Report a Change</Text>
                    <TouchableOpacity
                      onPress={closeReport}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                    >
                      <Ionicons name="close" size={20} color="#6B6B6B" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.reportVenueName}>{venue?.name}</Text>

                  <View style={styles.reasonsGrid}>
                    {REASONS.map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.reasonPill, selectedReason === r && styles.reasonPillActive]}
                        onPress={() => setSelectedReason(r)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.reasonText, selectedReason === r && styles.reasonTextActive]}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={styles.noteInput}
                    placeholder="Add a note (optional)"
                    placeholderTextColor="#ABABAB"
                    value={reportNote}
                    onChangeText={setReportNote}
                    multiline
                    numberOfLines={2}
                    maxLength={300}
                  />

                  {reportError && (
                    <Text style={styles.reportErrorText}>{reportError}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.sendButton, !selectedReason && styles.sendButtonDisabled]}
                    onPress={submitReport}
                    disabled={!selectedReason || reportSubmitting}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !selectedReason || reportSubmitting, busy: reportSubmitting }}
                  >
                    {reportSubmitting ? (
                      <View style={styles.sendButtonRow}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.sendButtonText}>Sending…</Text>
                      </View>
                    ) : (
                      <Text style={[styles.sendButtonText, !selectedReason && styles.sendButtonTextDisabled]}>
                        Send Report
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sheetBg:      { backgroundColor: '#FFFFFF', borderRadius: 16 },
  handle:       { backgroundColor: '#E8E8E4', width: 36 },
  scrollContent: { paddingBottom: 40 },

  photoContainer: { height: 200, backgroundColor: '#F7F7F5', overflow: 'hidden' },
  photoLabel: {
    position: 'absolute', bottom: 28, left: 12,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  photoLabelText: { fontSize: 11, fontFamily: Font.semiBold, color: '#FFFFFF' },
  dotsRow: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)' },
  heartButton: {
    position: 'absolute', top: 12, right: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  body:         { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  divider:      { height: StyleSheet.hairlineWidth, backgroundColor: '#E8E8E4', marginVertical: 4 },
  badgeRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  badgeText:    { fontSize: 12, fontFamily: Font.semiBold, color: '#22C55E', letterSpacing: 0.3 },
  name:         { fontSize: 20, fontFamily: Font.bold, color: '#0A0A0A' },
  meta:         { fontSize: 14, fontFamily: Font.regular, color: '#6B6B6B' },
  tagsLabel:    { fontSize: 11, fontFamily: Font.semiBold, color: '#ABABAB', textTransform: 'uppercase', letterSpacing: 0.5 },
  tagsScroll:   { gap: 6, paddingBottom: 2 },
  tag:            { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 100, borderWidth: 1, borderColor: '#E8E8E4' },
  tagText:        { fontSize: 12, fontFamily: Font.regular, color: '#6B6B6B' },
  tagWarning:     { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 100, borderWidth: 1, borderColor: '#F59E0B', backgroundColor: '#FEF3C7' },
  tagWarningText: { fontSize: 12, fontFamily: Font.semiBold, color: '#B45309' },
  verifiedDate: { fontSize: 12, fontFamily: Font.regular, color: '#6B6B6B', textAlign: 'center' },
  expiredText:  { color: '#F97316' },
  reportLink:   { alignItems: 'center', paddingVertical: 8 },
  reportLinkText: { fontSize: 13, fontFamily: Font.regular, color: '#ABABAB' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 14,
  },
  reportHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportTitle:    { fontSize: 17, fontFamily: Font.bold, color: '#0A0A0A' },
  reportVenueName:{ fontSize: 13, fontFamily: Font.regular, color: '#6B6B6B', marginTop: -6 },
  reasonsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonPill: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 100, borderWidth: 1, borderColor: '#E8E8E4', backgroundColor: '#FFFFFF',
  },
  reasonPillActive:    { borderColor: '#0A0A0A', backgroundColor: '#0A0A0A' },
  reasonText:          { fontSize: 13, fontFamily: Font.medium, color: '#1A1A1A' },
  reasonTextActive:    { color: '#FFFFFF' },
  noteInput: {
    borderWidth: 1, borderColor: '#E8E8E4', borderRadius: 10,
    padding: 12, fontSize: 14, fontFamily: Font.regular, color: '#0A0A0A',
    minHeight: 60, textAlignVertical: 'top',
  },
  sendButton:          { backgroundColor: '#0A0A0A', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sendButtonRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendButtonDisabled:  { backgroundColor: '#F7F7F5', borderWidth: 1, borderColor: '#E8E8E4' },
  sendButtonText:      { fontSize: 15, fontFamily: Font.semiBold, color: '#FFFFFF' },
  sendButtonTextDisabled: { color: '#ABABAB' },
  reportErrorText:     { fontSize: 13, fontFamily: Font.medium, color: '#EF4444', textAlign: 'center', marginBottom: 8 },
  successContent: { paddingVertical: 32, alignItems: 'center', gap: 10 },
  successIcon:    { fontSize: 32, color: '#22C55E' },
  successText:    { fontSize: 16, fontFamily: Font.semiBold, color: '#0A0A0A' },

  // Community photos
  communitySection: { paddingTop: 4, paddingBottom: 4 },
  communityLabel:   { fontSize: 11, fontFamily: Font.semiBold, color: '#ABABAB', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  communityRow:     { gap: 8, paddingBottom: 4 },
  communityThumb:   { width: 80, height: 80, borderRadius: 8 },
  addPhotoBtn:      { width: 80, height: 80, borderRadius: 8, borderWidth: 1.5, borderColor: '#E8E8E4', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  addPhotoBtnText:  { fontSize: 24, color: '#ABABAB', lineHeight: 28 },
  addPhotoBtnWrapper: { alignItems: 'center', gap: 6, width: 80 },
  addPhotoHint:       { fontSize: 11, fontFamily: Font.regular, color: '#ABABAB', textAlign: 'center', lineHeight: 15 },
  uploadErrorText:  { fontSize: 12, fontFamily: Font.medium, color: '#EF4444', marginTop: 4 },
  uploadNoticeText: { fontSize: 12, fontFamily: Font.medium, color: '#22C55E', marginTop: 4 },

  locationSection: { gap: 6 },
  locationBtns:    { flexDirection: 'row', gap: 8 },
  watchReviewBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, borderWidth: 1, borderColor: '#E8E8E4' },
  watchReviewText: { fontSize: 13, fontFamily: Font.medium, color: '#1A1A1A' },
  addressTextRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  address:         { fontSize: 13, fontFamily: Font.regular, color: '#6B6B6B', flexShrink: 1 },
  goNowBtn:        { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, borderWidth: 1, borderColor: '#E8E8E4' },
  goNowText:       { fontSize: 13, fontFamily: Font.medium, color: '#1A1A1A' },

  // Directions sheet
  directionsSheet:      { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  directionsTitle:      { fontSize: 11, fontFamily: Font.semiBold, color: '#ABABAB', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  directionsOption:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E8E8E4' },
  directionsIconBox:    { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  directionsOptionText: { flex: 1, fontSize: 15, fontFamily: Font.medium, color: '#0A0A0A' },
  directionsCancel:     { alignItems: 'center', paddingVertical: 14, marginTop: 2, borderRadius: 14, borderWidth: 1, borderColor: '#E8E8E4' },
  directionsCancelText: { fontSize: 15, fontFamily: Font.medium, color: '#6B6B6B' },

  // Photo preview modal
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center' },
  previewImage:   { width: SCREEN_W * 0.92, aspectRatio: 3 / 4, borderRadius: 12 },
  previewClose:   { position: 'absolute', top: 56, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
