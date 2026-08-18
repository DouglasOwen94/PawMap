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
  Easing,
  Keyboard,
  Linking,
  Platform,
  ScrollView as RNScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { GestureHandlerRootView, ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Font } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';

import { getDogSizeLabel, getOpenStatus, getSeatingLabel, getVerificationText, isExpiredVenue, isIndoorVerified } from '@/utils/venue';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { PhotoStrip } from '@/components/PhotoStrip';
import { Skeleton } from '@/components/Skeleton';
import type { Venue, CommunityPhoto } from '@/types/venue';

// Flat light-grey blurhash so photos fade in from grey, not white.
const PHOTO_PLACEHOLDER = '00QvwN';

// The tag and community rows scroll natively rather than through
// gesture-handler, which keeps a vertical drag started on a row from being
// swallowed before it reaches the sheet, and lets them scroll with a mouse or
// trackpad on desktop. Caveat: on a touchscreen they still cannot scroll while
// the sheet is collapsed, because gesture-handler holds pointer capture for
// the sheet's drag — the photo pager works around this with its own gesture
// (see PhotoStrip.web.tsx); these rows have not needed it yet.
const HorizontalScrollView = Platform.OS === 'web' ? RNScrollView : GestureScrollView;

type Props = {
  venue: Venue | null;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: (venue: Venue) => void;
};

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
  const [hoursExpanded, setHoursExpanded] = useState(false);

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
        useNativeDriver: false, // shares the sheet's transform with sheetTranslateY (JS-driven)
      }).start();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false, // must match sheetTranslateY's driver (same transform)
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (venue) {
      sheetRef.current?.snapToIndex(0);
      setHoursExpanded(false);
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
      // JS driver + timing (not spring) so taps register mid-slide with no jitter.
      Animated.timing(sheetTranslateY, { toValue: 0, duration: 320, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: false }),
    ]).start();
  }

  function closeReport() {
    Animated.parallel([
      Animated.timing(overlayOpacity,   { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetTranslateY,  { toValue: 400, duration: 220, useNativeDriver: false }),
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
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`).catch(() =>
      Alert.alert("Couldn't open Google Maps", 'Make sure the app or a browser is available on your device.')
    );
  }

  function openWaze() {
    if (!venue) return;
    Linking.openURL(`https://waze.com/ul?ll=${venue.lat},${venue.lng}&navigate=yes`).catch(() =>
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
      // JS driver (not native) so the sheet's touch hit-area tracks the slide
      // frame-by-frame — otherwise taps during the animation miss the buttons.
      // timing (not spring) avoids overshoot, which jitters on the JS thread.
      Animated.timing(dirOverlayOpacity, { toValue: 1, duration: 260, useNativeDriver: false }),
      Animated.timing(dirTranslateY, { toValue: 0, duration: 320, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: false }),
    ]).start();
  }

  function closeDirections() {
    Animated.parallel([
      Animated.timing(dirOverlayOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
      Animated.timing(dirTranslateY, { toValue: 300, duration: 220, useNativeDriver: false }),
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
        // The sheet's drag otherwise claims horizontal swipes too, which
        // blocks the photo/tag strips from scrolling sideways until the
        // sheet is fully expanded. Require ~10px of vertical movement before
        // the sheet starts dragging, and abandon the drag outright once a
        // gesture travels ~15px horizontally, so sideways swipes belong to
        // the strip underneath.
        activeOffsetY={[-10, 10]}
        failOffsetX={[-15, 15]}
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
                    {photos.length > 0 ? (
                      <PhotoStrip photos={photos} />
                    ) : (
                      <View style={styles.photoComingSoon}>
                        <Ionicons name="image-outline" size={22} color="#ABABAB" />
                        <Text style={styles.photoComingSoonText}>Photo coming soon</Text>
                      </View>
                    )}
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
                {/* ── Identity: name · meta · status chips ── */}
                <View style={styles.identity}>
                  <Text style={styles.name}>{venue.name}</Text>
                  <Text style={styles.metaLine}>
                    {typeof venue.rating === 'number' && (
                      <Text>
                        <Text style={styles.metaStar}>★</Text>
                        <Text style={styles.metaRating}> {venue.rating.toFixed(1)} </Text>
                        ·{' '}
                      </Text>
                    )}
                    {venue.neighbourhood} · {getSeatingLabel(venue.seating_type)}
                  </Text>

                  <View style={styles.chipRow}>
                    {verified && (
                      <View style={styles.verifiedChip}>
                        <View style={styles.verifiedChipDot} />
                        <Text style={styles.verifiedChipText}>Indoor Verified</Text>
                      </View>
                    )}
                    {expired && (
                      <View style={styles.expiredChip}>
                        <Ionicons name="alert-circle-outline" size={13} color="#6B6B6B" />
                        <Text style={styles.expiredChipText}>Verification Expired</Text>
                      </View>
                    )}
                    {(() => {
                      const status = getOpenStatus(venue);
                      if (status.status === 'unknown') return null;
                      return (
                        <TouchableOpacity
                          onPress={() => setHoursExpanded(e => !e)}
                          activeOpacity={0.7}
                          style={styles.statusChip}
                          accessibilityRole="button"
                          accessibilityLabel={hoursExpanded ? 'Collapse opening hours' : 'Expand opening hours'}
                        >
                          <View style={[styles.statusChipDot, { backgroundColor: status.color }]} />
                          <Text style={styles.statusChipText}>{status.label}</Text>
                          <Ionicons name={hoursExpanded ? 'chevron-up' : 'chevron-down'} size={12} color="#6B6B6B" />
                        </TouchableOpacity>
                      );
                    })()}
                  </View>

                  {hoursExpanded && venue.weekdayHours && (
                    <View style={styles.hoursList}>
                      {venue.weekdayHours.map((line, i) => {
                        const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
                        return (
                          <Text
                            key={i}
                            style={[styles.hoursLine, i === todayIdx && styles.hoursLineToday]}
                          >
                            {line}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* ── Address + actions ── */}
                <View style={styles.actionSection}>
                  {venue.address && (
                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={14} color="#6B6B6B" />
                      <Text style={styles.address}>{venue.address}</Text>
                    </View>
                  )}
                  <View style={styles.actionBtns}>
                    <TouchableOpacity style={styles.primaryBtn} onPress={openDirections} activeOpacity={0.85}>
                      <Ionicons name="navigate" size={15} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Go now</Text>
                    </TouchableOpacity>
                    {venue.review_url && (
                      <TouchableOpacity style={styles.secondaryBtn} onPress={openReview} activeOpacity={0.75}>
                        <Ionicons name="logo-tiktok" size={13} color="#1A1A1A" />
                        <Text style={styles.secondaryBtnText}>Watch review</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* ── Tags ── */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>What&apos;s here</Text>
                  <HorizontalScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
                    {/* Warning tags first — founder-added exceptions only.
                        leash_free === false is NOT one of these: most SG
                        venues require a leash, so that's the unremarkable
                        default, not a warning. It renders nothing, same as
                        leash_free === null (not yet checked). */}
                    {Array.isArray(venue.tags) && venue.tags.filter(isWarningTag).map(tag => (
                      <View key={tag} style={styles.tagWarning}><Text style={styles.tagWarningText}>⚠ {tag}</Text></View>
                    ))}
                    {/* Leash-free is the rare, worth-knowing fact (most venues
                        don't offer it) — shown first among the positive tags,
                        in its own color so it doesn't blend into the neutral
                        amenity pills next to it. */}
                    {venue.leash_free === true && (
                      <View style={styles.tagLeashFree}><Text style={styles.tagLeashFreeText}>Leash-free</Text></View>
                    )}
                    {venue.pet_menu && (
                      <View style={styles.tag}><Text style={styles.tagText}>Pet menu</Text></View>
                    )}
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{getDogSizeLabel(venue.dog_sizes_allowed)}</Text>
                    </View>
                    {Array.isArray(venue.tags) && venue.tags.filter(t => !isWarningTag(t)).map(tag => (
                      <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
                    ))}
                  </HorizontalScrollView>
                </View>

                {/* ── Community photos ── */}
                <View style={styles.section}>
                  {/* Hint sits in the header, not under the + tile — under it,
                      only one tile carried two lines of text and the row's
                      baseline came out visibly uneven. */}
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>From the community</Text>
                    {communityPhotos.length < 10 && (
                      <Text style={styles.sectionHint}>Love this place? Share a photo.</Text>
                    )}
                  </View>
                  <HorizontalScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityRow}>
                    {communityPhotos.length < 10 && (
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
                    )}
                    {photosLoading
                      ? [0, 1, 2].map(i => (
                          <Skeleton key={i} width={80} height={80} radius={10} />
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
                            {/* Nothing else signals these open full screen. */}
                            <View style={styles.thumbExpandBadge}>
                              <Ionicons name="expand" size={10} color="#FFFFFF" />
                            </View>
                          </TouchableOpacity>
                        ))}
                  </HorizontalScrollView>
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

                {/* ── Footer: verification + report ── */}
                <View style={styles.footer}>
                  <Text style={[styles.verifiedDate, expired && styles.expiredText]}>
                    {getVerificationText(venue)}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={openReport}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.reportLinkText}>Report a change</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Full-screen community photo viewer */}
      <PhotoLightbox
        photos={communityPhotos}
        index={previewIndex}
        onClose={() => setPreviewIndex(null)}
      />

      {/* Directions action sheet */}
      <Modal visible={directionsVisible} transparent animationType="none" onRequestClose={() => closeDirections()}>
        {/* GestureHandlerRootView is required inside a Modal so touchables register
            on the first tap — the Modal renders outside the app's root gesture handler. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
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
        </GestureHandlerRootView>
      </Modal>

      <Modal
        visible={reportVisible}
        transparent
        animationType="none"
        onRequestClose={closeReport}
      >
        {/* GestureHandlerRootView required inside Modal — see directions sheet note */}
        <GestureHandlerRootView style={{ flex: 1 }}>
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
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sheetBg:      { backgroundColor: '#FFFFFF', borderRadius: 16 },
  handle:       { backgroundColor: '#E8E8E4', width: 36 },
  scrollContent: { paddingBottom: 40 },

  photoContainer: { height: 200, backgroundColor: '#F7F7F5', overflow: 'hidden' },
  photoComingSoon: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoComingSoonText: { fontSize: 13, fontFamily: Font.medium, color: '#ABABAB' },
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

  body:         { paddingHorizontal: 20, paddingTop: 18, gap: 20 },

  // Identity
  identity:     { gap: 10 },
  name:         { fontSize: 21, fontFamily: Font.bold, color: '#0A0A0A', letterSpacing: -0.2 },
  metaLine:     { fontSize: 14, fontFamily: Font.regular, color: '#6B6B6B' },
  metaStar:     { color: '#F59E0B' },
  metaRating:   { fontFamily: Font.semiBold, color: '#1A1A1A' },

  // Status chips
  chipRow:          { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  verifiedChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  verifiedChipDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  verifiedChipText: { fontSize: 12, fontFamily: Font.semiBold, color: '#16A34A' },
  expiredChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F1EF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  expiredChipText:  { fontSize: 12, fontFamily: Font.semiBold, color: '#6B6B6B' },
  statusChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F7F7F5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  statusChipDot:    { width: 7, height: 7, borderRadius: 4 },
  statusChipText:   { fontSize: 12, fontFamily: Font.medium, color: '#1A1A1A' },

  hoursList:      { paddingTop: 2, paddingLeft: 2, gap: 4 },
  hoursLine:      { fontSize: 13, fontFamily: Font.regular, color: '#6B6B6B', lineHeight: 19 },
  hoursLineToday: { fontFamily: Font.semiBold, color: '#0A0A0A' },

  // Address + actions
  actionSection:    { gap: 12 },
  addressRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  address:          { fontSize: 13, fontFamily: Font.regular, color: '#6B6B6B', flexShrink: 1 },
  actionBtns:       { flexDirection: 'row', gap: 8 },
  primaryBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#0A0A0A', paddingVertical: 12, borderRadius: 100 },
  primaryBtnText:   { fontSize: 14, fontFamily: Font.semiBold, color: '#FFFFFF' },
  secondaryBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 100, borderWidth: 1, borderColor: '#E8E8E4' },
  secondaryBtnText: { fontSize: 14, fontFamily: Font.medium, color: '#1A1A1A' },

  // Sections (tags, community)
  section:        { gap: 10 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionLabel:   { fontSize: 11, fontFamily: Font.semiBold, color: '#ABABAB', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHint:    { fontSize: 11, fontFamily: Font.regular, color: '#ABABAB', flexShrink: 1, textAlign: 'right' },
  tagsScroll:     { gap: 6, paddingBottom: 2 },
  tag:            { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 100, borderWidth: 1, borderColor: '#E8E8E4' },
  tagText:        { fontSize: 12, fontFamily: Font.regular, color: '#6B6B6B' },
  // Reuses the app's existing "verified / good" green (color-green) rather
  // than a new hue — same visual vocabulary as the Indoor Verified badge.
  tagLeashFree:     { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.12)' },
  tagLeashFreeText: { fontSize: 12, fontFamily: Font.semiBold, color: '#15803D' }, // darkened for 4.5:1+ contrast on the tint, not the raw #22C55E
  tagWarning:     { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 100, borderWidth: 1, borderColor: '#F59E0B', backgroundColor: '#FEF3C7' },
  tagWarningText: { fontSize: 12, fontFamily: Font.semiBold, color: '#B45309' },

  // Footer
  footer:         { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8E4', paddingTop: 14, gap: 8 },
  verifiedDate:   { fontSize: 12, fontFamily: Font.regular, color: '#6B6B6B' },
  expiredText:    { color: '#F97316' },
  reportLinkText: { fontSize: 13, fontFamily: Font.medium, color: '#6B6B6B', textDecorationLine: 'underline' },

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
  communityRow:     { gap: 8, paddingBottom: 4 },
  communityThumb:   { width: 80, height: 80, borderRadius: 10 },
  thumbExpandBadge: { position: 'absolute', bottom: 5, right: 5, width: 18, height: 18, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn:      { width: 80, height: 80, borderRadius: 10, borderWidth: 1.5, borderColor: '#E8E8E4', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  addPhotoBtnText:  { fontSize: 24, color: '#ABABAB', lineHeight: 28 },
  uploadErrorText:  { fontSize: 12, fontFamily: Font.medium, color: '#EF4444', marginTop: 4 },
  uploadNoticeText: { fontSize: 12, fontFamily: Font.medium, color: '#22C55E', marginTop: 4 },

  // Directions sheet
  directionsSheet:      { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  directionsTitle:      { fontSize: 11, fontFamily: Font.semiBold, color: '#ABABAB', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  directionsOption:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E8E8E4' },
  directionsIconBox:    { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  directionsOptionText: { flex: 1, fontSize: 15, fontFamily: Font.medium, color: '#0A0A0A' },
  directionsCancel:     { alignItems: 'center', paddingVertical: 14, marginTop: 2, borderRadius: 14, borderWidth: 1, borderColor: '#E8E8E4' },
  directionsCancelText: { fontSize: 15, fontFamily: Font.medium, color: '#6B6B6B' },
});
