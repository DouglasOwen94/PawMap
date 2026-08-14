import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Imported under the react-native-maps name on purpose: metro.config.js
// swaps this for @teovilla/react-native-web-maps when bundling for web, and
// react-native-maps ships the accurate types for the API both implement.
import MapView, { Marker, type MapViewProps } from 'react-native-maps';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Font } from '@/constants/fonts';
import { FilterChips, type FilterKey } from '@/components/FilterChips';
import { MapPin } from '@/components/MapPin';
import { VenueBottomSheet } from '@/components/VenueBottomSheet';
import { supabase } from '@/lib/supabase';
import { useSavedVenues } from '@/hooks/useSavedVenues';
import { buildMarkerPositions, isExpiredVenue, MS_PER_DAY, VERIFIED_DAYS } from '@/utils/venue';
import type { Venue } from '@/types/venue';

const SINGAPORE_REGION = {
  latitude: 1.3521,
  longitude: 103.8198,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// The web shim accepts two props react-native-maps has no concept of. They
// can't be declared by module augmentation because react-native-maps exports
// MapViewProps as a type alias rather than an interface, so declare them here
// instead — this file only ever renders against the web shim.
const WebMapView = MapView as unknown as React.ComponentType<
  MapViewProps & {
    ref?: React.Ref<MapView>;
    googleMapsApiKey?: string;
    options?: Record<string, unknown>;
  }
>;

function venueMatchesFilter(venue: Venue, filter: FilterKey): boolean {
  switch (filter) {
    case 'All':
      return true;
    case 'Indoor': {
      if (!venue.indoor_verified || !venue.last_verified_date) return false;
      if (isExpiredVenue(venue)) return false;
      const age = (Date.now() - new Date(venue.last_verified_date).getTime()) / MS_PER_DAY;
      return age <= VERIFIED_DAYS;
    }
    case 'Outdoor':
      return venue.seating_type === 'outdoor' || venue.seating_type === 'both';
    case 'Open Now': {
      // Prefer live Google Places data when available
      if (venue.openNow != null) return venue.openNow;
      // Fallback: manually-entered Supabase hours
      if (!venue.hours) return false;
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const hours = venue.hours[dayNames[new Date().getDay()]];
      if (!hours) return false;
      const now = new Date().getHours() * 60 + new Date().getMinutes();
      const [openH, openM] = hours.open.split(':').map(Number);
      const [closeH, closeM] = hours.close.split(':').map(Number);
      return now >= openH * 60 + openM && now < closeH * 60 + closeM;
    }
    case 'Pet Menu':
      return venue.pet_menu;
    case 'Leash-free':
      return venue.leash_free === true;
  }
}

function venueMatchesFilters(venue: Venue, filters: FilterKey[]): boolean {
  if (filters.length === 0) return true;
  return filters.every(f => venueMatchesFilter(venue, f));
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSave } = useSavedVenues();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const markerPositions = useMemo(() => buildMarkerPositions(venues), [venues]);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const filteredVenues = useMemo(
    () => venues.filter(v => v.lat != null && v.lng != null && venueMatchesFilters(v, activeFilters)),
    [venues, activeFilters]
  );
  const noResults = !loading && activeFilters.length > 0 && venues.length > 0 && filteredVenues.length === 0;
  const currentRegionRef = useRef(SINGAPORE_REGION);
  const lastMarkerPressAt = useRef(0);

  const { venueId } = useLocalSearchParams<{ venueId?: string }>();
  const handledVenueId = useRef<string | null>(null);

  async function fetchVenues() {
    const { data, error } = await supabase.from('venues').select('*').eq('status', 'live');
    if (error || !data) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoadError(false);
    // Places Details (legacy) API has no browser CORS support, so live
    // ratings/hours can't be fetched from web — venues fall back to
    // manually-entered Supabase hours/rating, same as when this fetch
    // fails on native.
    setVenues(data as Venue[]);
    setLoading(false);
  }

  function handleRetry() {
    setLoading(true);
    fetchVenues();
  }

  useEffect(() => {
    checkLocationPermission();
  }, []);

  // Re-fetch when app returns to foreground (e.g. after approving in dashboard)
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') fetchVenues();
    });
    return () => sub.remove();
  }, []);

  // Open a venue when arriving from the Saved tab
  useEffect(() => {
    if (!venueId || venues.length === 0) return;
    if (handledVenueId.current === venueId) return;
    const venue = venues.find(v => String(v.id) === venueId);
    if (venue) {
      handledVenueId.current = venueId;
      handleMarkerPress(venue);
      router.setParams({ venueId: '' });
    }
  }, [venueId, venues]);

  useFocusEffect(
    useCallback(() => {
      fetchVenues();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (selectedVenue !== null) {
          handleSheetClose();
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [selectedVenue])
  );

  function handleFilterSelect(filter: FilterKey) {
    setActiveFilters(prev => {
      if (filter === 'All') return [];
      return prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter];
    });
  }

  function handleMarkerPress(venue: Venue) {
    lastMarkerPressAt.current = Date.now();
    setSelectedVenue(venue);
    if (venue.lat == null || venue.lng == null) return;
    // Centre pin in the visible map area above the 65% bottom sheet.
    // animateCamera (pure pan, no zoom set) instead of animateToRegion:
    // on web animateToRegion goes through Google's fitBounds(), which
    // snaps to the nearest whole zoom level that fully contains the
    // bounds — usually rounding out — and since the next tap reads back
    // that already-wider zoom, repeated taps drift further out each time.
    const region = currentRegionRef.current;
    const offset = region.latitudeDelta * 0.325;
    mapRef.current?.animateCamera(
      { center: { latitude: venue.lat - offset, longitude: venue.lng } },
      { duration: 350 }
    );
  }

  function handleSheetClose() {
    setSelectedVenue(null);
  }

  // Tapping empty map closes the sheet — but a marker tap must not.
  // The marker stops its click from reaching the map, which covers mouse
  // input; on touch, Google can derive the map tap from touch events that
  // never pass through the marker's click handler, so this also ignores a
  // map press landing right after a marker press.
  function handleMapPress() {
    if (Date.now() - lastMarkerPressAt.current < 400) return;
    handleSheetClose();
  }

  async function checkLocationPermission() {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      setShowUserLocation(true);
      centreOnUser();
      return;
    }
    if (status === 'undetermined') {
      // react-native-web's Alert.alert() is a no-op — there's no custom
      // dialog on web, so just request directly. The browser shows its
      // own native "use your location?" prompt.
      requestPermission();
    }
  }

  async function requestPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setShowUserLocation(true);
      centreOnUser();
    }
  }

  async function centreOnUser() {
    // animateCamera with an explicit zoom (not animateToRegion/fitBounds —
    // see handleMarkerPress for why fitBounds-derived zoom is unreliable
    // on web) so opening the app zooms straight to street level.
    const moveTo = (lat: number, lng: number) =>
      mapRef.current?.animateCamera({ center: { latitude: lat, longitude: lng }, zoom: 15 }, { duration: 800 });

    setLocatingUser(true);
    try {
      // Use cached position instantly if available
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        moveTo(last.coords.latitude, last.coords.longitude);
        return;
      }

      // No cache — a fresh GPS fix is what's slow on some Android browsers,
      // hence the "finding your location" pill this is guarding.
      const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      moveTo(fresh.coords.latitude, fresh.coords.longitude);
    } finally {
      setLocatingUser(false);
    }
  }

  return (
    <View style={styles.container}>
      <WebMapView
        ref={mapRef}
        provider="google"
        style={StyleSheet.absoluteFillObject}
        initialRegion={SINGAPORE_REGION}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        moveOnMarkerPress={false}
        customMapStyle={MAP_STYLE}
        googleMapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY}
        onMapReady={() => setMapReady(true)}
        onPress={handleMapPress}
        options={{
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          // Stops Google's built-in place-name/POI info bubble from
          // popping up when tapping labels baked into the base map tiles.
          clickableIcons: false,
          // Removes the "Keyboard shortcuts" link from the bottom-right
          // strip — it references a real feature, so turning the feature
          // off removes its own help link. The rest of that strip ("Map
          // data ©Google", "Terms", "Report a map error") is required
          // attribution under Google's Maps Platform terms and can't be
          // hidden — see the chat explanation for why this stops here.
          keyboardShortcuts: false,
        }}
        onRegionChange={(region) => {
          currentRegionRef.current = region;
        }}
        onRegionChangeComplete={(region) => {
          currentRegionRef.current = region;
        }}
      >
        {filteredVenues.map(venue => (
            <Marker
              key={venue.id}
              coordinate={markerPositions.get(venue.id) ?? { latitude: venue.lat!, longitude: venue.lng! }}
              onPress={() => handleMarkerPress(venue)}
              anchor={{ x: 0.5, y: 1 }}
              style={{ backgroundColor: 'transparent' }}
            >
              <MapPin
                venue={venue}
                selected={selectedVenue?.id === venue.id}
                isExpired={isExpiredVenue(venue)}
                isSaved={isSaved(venue.id)}
              />
            </Marker>
          ))
        }
      </WebMapView>

      {/* Google's script + tile load is the slow, unavoidable part of a
          fresh page load on web — this covers that instead of leaving a
          blank white rect where the map will be. */}
      {!mapReady && <MapSkeleton />}

      {loading && venues.length === 0 && !loadError && (
        <View style={[styles.statusPill, { top: insets.top + 12 }]} pointerEvents="none">
          <ActivityIndicator size="small" color="#6B6B6B" />
          <Text style={styles.statusPillText}>Loading venues…</Text>
        </View>
      )}

      {locatingUser && (
        <View style={[styles.statusPill, { top: insets.top + (loading && venues.length === 0 ? 56 : 12) }]} pointerEvents="none">
          <ActivityIndicator size="small" color="#6B6B6B" />
          <Text style={styles.statusPillText}>Finding your location…</Text>
        </View>
      )}

      {loadError && venues.length === 0 && (
        <View style={[styles.errorBanner, { top: insets.top + 12 }]}>
          <Text style={styles.errorBannerText}>Couldn&apos;t load venues.</Text>
          <TouchableOpacity
            onPress={handleRetry}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Retry loading venues"
          >
            <Text style={styles.errorBannerRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {noResults && (
        <View style={[styles.noResultsCard, { top: insets.top + 60 }]} pointerEvents="box-none">
          <Text style={styles.noResultsTitle}>No venues match your filters</Text>
          <Text style={styles.noResultsSub}>Try removing a filter to see more spots</Text>
          <TouchableOpacity
            onPress={() => setActiveFilters([])}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
            style={styles.noResultsBtn}
          >
            <Text style={styles.noResultsBtnText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      )}

      <FilterChips active={activeFilters} onSelect={handleFilterSelect} />

      <VenueBottomSheet
        venue={selectedVenue}
        onClose={handleSheetClose}
        isSaved={selectedVenue ? isSaved(selectedVenue.id) : false}
        onToggleSave={toggleSave}
      />
    </View>
  );
}

/** Covers the map area until Google's script + tiles finish loading. */
function MapSkeleton() {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.mapSkeleton} pointerEvents="none">
      <Animated.View style={pulseStyle}>
        <Ionicons name="paw" size={40} color="#ABABAB" />
      </Animated.View>
      <Text style={styles.mapSkeletonText}>Loading map…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapSkeleton: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F7F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mapSkeletonText: {
    fontSize: 13,
    fontFamily: Font.medium,
    color: '#ABABAB',
  },
  statusPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusPillText: {
    fontSize: 13,
    fontFamily: Font.medium,
    color: '#6B6B6B',
  },
  errorBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  errorBannerText: {
    fontSize: 13,
    fontFamily: Font.medium,
    color: '#1A1A1A',
  },
  errorBannerRetry: {
    fontSize: 13,
    fontFamily: Font.semiBold,
    color: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  noResultsCard: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 4,
  },
  noResultsTitle: {
    fontSize: 15,
    fontFamily: Font.semiBold,
    color: '#0A0A0A',
  },
  noResultsSub: {
    fontSize: 13,
    fontFamily: Font.regular,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  noResultsBtn: {
    marginTop: 8,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 100,
  },
  noResultsBtnText: {
    fontSize: 13,
    fontFamily: Font.semiBold,
    color: '#FFFFFF',
  },
});

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#EDF0EB' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B6B6B' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D6DFE8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E8E8E4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#E8E8E4' }],
  },
];
