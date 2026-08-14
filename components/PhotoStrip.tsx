import { Image } from 'expo-image';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { Font } from '@/constants/fonts';

const SCREEN_W = Dimensions.get('window').width;
const PHOTO_H = 200;
// Flat light-grey blurhash so photos fade in from grey, not white.
const PHOTO_PLACEHOLDER = '00QvwN';

export type StripPhoto = { uri: string; label: string | null };

/**
 * Venue photo pager. Native uses a paging ScrollView, which already
 * coordinates with the bottom sheet's drag. See PhotoStrip.web.tsx for why
 * the web build needs a gesture-driven implementation instead.
 */
export function PhotoStrip({ photos }: { photos: StripPhoto[] }) {
  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      scrollEnabled={photos.length > 1}
    >
      {photos.map((photo, i) => (
        <View key={i} style={styles.page}>
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
  );
}

const styles = StyleSheet.create({
  page: { width: SCREEN_W, height: PHOTO_H },
  photoLabel: {
    position: 'absolute', bottom: 28, left: 12,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  photoLabelText: { fontSize: 11, fontFamily: Font.semiBold, color: '#FFFFFF' },
});
