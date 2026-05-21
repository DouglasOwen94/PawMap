import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import type { Venue, CommunityPhoto } from '@/types/venue';

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

export function VenueBottomSheet({ venue, onClose, isSaved, onToggleSave }: Props) {
  const sheetRef   = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['65%'], []);

  const [reportVisible, setReportVisible]       = useState(false);
  const [selectedReason, setSelectedReason]     = useState<string | null>(null);
  const [reportNote, setReportNote]             = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted]   = useState(false);

  const [communityPhotos, setCommunityPhotos] = useState<CommunityPhoto[]>([]);
  const [uploading, setUploading]             = useState(false);
  const [previewIndex, setPreviewIndex]       = useState<number | null>(null);
  const [uploadError, setUploadError]         = useState<string | null>(null);

  // Separate animated values so the overlay fades while the sheet slides
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(400)).current;
  // Tracks keyboard height so the sheet lifts above the keyboard
  const keyboardOffset  = useRef(new Animated.Value(0)).current;

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
      supabase
        .from('community_photos')
        .select('*')
        .eq('venue_id', venue.id)
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setCommunityPhotos(data as CommunityPhoto[]); });
    } else {
      sheetRef.current?.close();
      setCommunityPhotos([]);
    }
  }, [venue]);

  const insets   = useSafeAreaInsets();
  const verified = venue ? isIndoorVerified(venue) : false;
  const expired  = venue ? isExpiredVenue(venue)    : false;

  function openReport() {
    setSelectedReason(null);
    setReportNote('');
    setReportSubmitted(false);
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
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = (asset.mimeType?.split('/')[1]) ?? 'jpg';
      const path = `community/${venue.id}/${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('venue-photos')
        .upload(path, arrayBuffer, { contentType: asset.mimeType ?? `image/${ext}` });

      if (uploadError) throw new Error(`Storage: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('venue-photos').getPublicUrl(path);
      const { data: newPhoto, error: dbError } = await supabase
        .from('community_photos')
        .insert({ venue_id: venue.id, photo_url: urlData.publicUrl })
        .select()
        .single();

      if (dbError) throw new Error(`DB: ${dbError.message}`);
      if (newPhoto) setCommunityPhotos(prev => [newPhoto as CommunityPhoto, ...prev]);
    } catch {
      setUploadError('Upload failed — please try again.');
      setTimeout(() => setUploadError(null), 3000);
    } finally {
      setUploading(false);
    }
  }

  function openGoogleMaps() {
    if (!venue) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`);
  }

  function openWaze() {
    if (!venue) return;
    Linking.openURL(`https://waze.com/ul?ll=${venue.lat},${venue.lng}&navigate=yes`);
  }

  function openAddressOnMap() {
    if (!venue) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`);
  }

  async function submitReport() {
    if (!selectedReason || !venue) return;
    setReportSubmitting(true);
    await supabase.from('change_reports').insert({
      venue_id: venue.id,
      venue_name: venue.name,
      reason: selectedReason,
      note: reportNote.trim() || null,
    });
    setReportSubmitting(false);
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
        <BottomSheetView style={styles.content}>
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

              {/* Community photos strip */}
              <View style={styles.communitySection}>
                <Text style={styles.communityLabel}>From the community</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityRow}>
                  <View style={styles.addPhotoBtnWrapper}>
                    <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto} activeOpacity={0.7} disabled={uploading}>
                      <Text style={styles.addPhotoBtnText}>{uploading ? '…' : '+'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.addPhotoHint}>Love this place?{'\n'}Share a photo.</Text>
                  </View>
                  {communityPhotos.map((photo, i) => (
                    <TouchableOpacity key={photo.id} onPress={() => setPreviewIndex(i)} activeOpacity={0.85}>
                      <Image source={{ uri: photo.photo_url }} style={styles.communityThumb} contentFit="cover" transition={300} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {uploadError && (
                  <Text style={styles.uploadErrorText}>{uploadError}</Text>
                )}
              </View>

              <View style={[styles.body, { paddingBottom: insets.bottom + 20 }]}>
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

                {venue.address && (
                  <TouchableOpacity style={styles.addressRow} onPress={openAddressOnMap} activeOpacity={0.7}>
                    <Ionicons name="location-outline" size={13} color="#6B6B6B" />
                    <Text style={styles.address}>{venue.address}</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.tagsRow}>
                  {venue.pet_menu && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Pet menu</Text>
                    </View>
                  )}
                  {venue.leash_free === true && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Leash-free</Text>
                    </View>
                  )}
                  {venue.leash_free === false && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Leash required</Text>
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

                <Text style={[styles.verifiedDate, expired && styles.expiredText]}>
                  {getVerificationText(venue)}
                </Text>

                <View style={styles.directionsRow}>
                  <TouchableOpacity style={styles.dirBtn} onPress={openGoogleMaps} activeOpacity={0.75}>
                    <Ionicons name="navigate-outline" size={14} color="#1A1A1A" />
                    <Text style={styles.dirBtnText}>Google Maps</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dirBtn} onPress={openWaze} activeOpacity={0.75}>
                    <Ionicons name="navigate-outline" size={14} color="#1A1A1A" />
                    <Text style={styles.dirBtnText}>Waze</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.reportButton}
                  activeOpacity={0.7}
                  onPress={openReport}
                >
                  <Text style={styles.reportButtonText}>Report a Change</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </BottomSheetView>
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
                <Image source={{ uri: item.photo_url }} style={styles.previewImage} contentFit="cover" />
              </View>
            )}
          />
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewIndex(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
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
                  <Text style={styles.successText}>Thanks! We'll check it out.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>Report a Change</Text>
                    <TouchableOpacity onPress={closeReport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                  />

                  <TouchableOpacity
                    style={[styles.sendButton, !selectedReason && styles.sendButtonDisabled]}
                    onPress={submitReport}
                    disabled={!selectedReason || reportSubmitting}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.sendButtonText, !selectedReason && styles.sendButtonTextDisabled]}>
                      {reportSubmitting ? 'Sending…' : 'Send Report'}
                    </Text>
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
  sheetBg:  { backgroundColor: '#FFFFFF', borderRadius: 16 },
  handle:   { backgroundColor: '#E8E8E4', width: 36 },
  content:  { flex: 1 },

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

  body:         { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  badgeRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  badgeText:    { fontSize: 12, fontFamily: Font.semiBold, color: '#22C55E', letterSpacing: 0.3 },
  name:         { fontSize: 20, fontFamily: Font.bold, color: '#0A0A0A' },
  meta:         { fontSize: 14, fontFamily: Font.regular, color: '#6B6B6B' },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag:          { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 100, borderWidth: 1, borderColor: '#E8E8E4' },
  tagText:      { fontSize: 12, fontFamily: Font.regular, color: '#6B6B6B' },
  verifiedDate: { fontSize: 12, fontFamily: Font.regular, color: '#6B6B6B', marginTop: 2 },
  expiredText:  { color: '#F97316' },
  reportButton: {
    marginTop: 8, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#E8E8E4', alignItems: 'center',
  },
  reportButtonText: { fontSize: 14, fontFamily: Font.medium, color: '#1A1A1A' },

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
  sendButtonDisabled:  { backgroundColor: '#F7F7F5', borderWidth: 1, borderColor: '#E8E8E4' },
  sendButtonText:      { fontSize: 15, fontFamily: Font.semiBold, color: '#FFFFFF' },
  sendButtonTextDisabled: { color: '#ABABAB' },
  successContent: { paddingVertical: 32, alignItems: 'center', gap: 10 },
  successIcon:    { fontSize: 32, color: '#22C55E' },
  successText:    { fontSize: 16, fontFamily: Font.semiBold, color: '#0A0A0A' },

  // Community photos
  communitySection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  communityLabel:   { fontSize: 11, fontFamily: Font.semiBold, color: '#ABABAB', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  communityRow:     { gap: 8, paddingBottom: 4 },
  communityThumb:   { width: 80, height: 80, borderRadius: 8 },
  addPhotoBtn:      { width: 80, height: 80, borderRadius: 8, borderWidth: 1.5, borderColor: '#E8E8E4', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  addPhotoBtnText:  { fontSize: 24, color: '#ABABAB', lineHeight: 28 },
  addPhotoBtnWrapper: { alignItems: 'center', gap: 6, width: 80 },
  addPhotoHint:       { fontSize: 11, fontFamily: Font.regular, color: '#ABABAB', textAlign: 'center', lineHeight: 15 },
  uploadErrorText:  { fontSize: 12, fontFamily: Font.medium, color: '#EF4444', marginTop: 4 },

  addressRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  address:        { fontSize: 13, fontFamily: Font.regular, color: '#6B6B6B', flexShrink: 1 },
  directionsRow:  { flexDirection: 'row', gap: 8, marginTop: 4 },
  dirBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E8E8E4' },
  dirBtnText:     { fontSize: 13, fontFamily: Font.medium, color: '#1A1A1A' },

  // Photo preview modal
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center' },
  previewImage:   { width: SCREEN_W * 0.92, aspectRatio: 3 / 4, borderRadius: 12 },
  previewClose:   { position: 'absolute', top: 56, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
