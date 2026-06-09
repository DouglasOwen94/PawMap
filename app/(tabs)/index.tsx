import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Font } from '@/constants/fonts';
import { FilterChips, type FilterKey } from '@/components/FilterChips';
import { MapPin } from '@/components/MapPin';
import { VenueBottomSheet } from '@/components/VenueBottomSheet';
import { supabase } from '@/lib/supabase';
import { fetchPlaceDetails } from '@/lib/places';
import { useSavedVenues } from '@/hooks/useSavedVenues';
import { buildMarkerPositions, isExpiredVenue, MS_PER_DAY, VERIFIED_DAYS } from '@/utils/venue';
import type { Venue } from '@/types/venue';

const SINGAPORE_REGION = {
  latitude: 1.3521,
  longitude: 103.8198,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

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
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const filteredVenues = useMemo(
    () => venues.filter(v => v.lat != null && v.lng != null && venueMatchesFilters(v, activeFilters)),
    [venues, activeFilters]
  );
  const noResults = !loading && activeFilters.length > 0 && venues.length > 0 && filteredVenues.length === 0;
  const currentRegionRef = useRef(SINGAPORE_REGION);

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
    const venues = data as Venue[];
    const results = await Promise.allSettled(
      venues.map(v => v.google_place_id ? fetchPlaceDetails(v.google_place_id) : Promise.resolve(null))
    );
    setVenues(
      venues.map((v, i) => {
        const r = results[i];
        if (r.status !== 'fulfilled' || !r.value) return v;
        const { rating, openNow, closingTime, weekdayHours } = r.value;
        return {
          ...v,
          ...(rating        != null ? { rating }        : {}),
          ...(openNow       != null ? { openNow }       : {}),
          ...(closingTime   != null ? { closingTime }   : {}),
          ...(weekdayHours  != null ? { weekdayHours }  : {}),
        };
      })
    );
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
      // 3 s gives Android time to load network images before freezing the bitmap
      const timer = setTimeout(() => setTracksViewChanges(false), 3000);
      fetchVenues();
      return () => clearTimeout(timer);
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

  // Android freezes each pin's bitmap once tracksViewChanges flips to false (perf).
  // When the filter set changes, the map layer won't repaint which pins are shown
  // until the user pans — so briefly re-enable tracking to force an immediate redraw.
  // Skip the initial mount so we don't cut short the 3 s image-loading grace period
  // set up in the focus effect (which would risk blank pins on first load).
  const skipInitialFilterRedraw = useRef(true);
  useEffect(() => {
    if (skipInitialFilterRedraw.current) {
      skipInitialFilterRedraw.current = false;
      return;
    }
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, [activeFilters]);

  function handleMarkerPress(venue: Venue) {
    setSelectedVenue(venue);
    if (venue.lat == null || venue.lng == null) return;
    // Centre pin in the visible map area above the 65% bottom sheet
    const region = currentRegionRef.current;
    const offset = region.latitudeDelta * 0.325;
    mapRef.current?.animateToRegion(
      {
        latitude: venue.lat - offset,
        longitude: venue.lng,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      },
      350
    );
  }

  function handleSheetClose() {
    setTracksViewChanges(true);
    setSelectedVenue(null);
    setTimeout(() => setTracksViewChanges(false), 300);
  }

  async function checkLocationPermission() {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      setShowUserLocation(true);
      centreOnUser();
      return;
    }
    if (status === 'undetermined') {
      Alert.alert(
        'Find cafes near you',
        'Allow PawMap to use your location so we can show pet-friendly spots nearby. Your location is only used while the app is open.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Allow', onPress: requestPermission },
        ]
      );
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
    const region = (lat: number, lng: number) => ({
      latitude: lat, longitude: lng, latitudeDelta: 0.04, longitudeDelta: 0.04,
    });

    // Use cached position instantly if available
    const last = await Location.getLastKnownPositionAsync();
    if (last) {
      mapRef.current?.animateToRegion(region(last.coords.latitude, last.coords.longitude), 800);
      return;
    }

    // No cache — wait for a fresh fix
    const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    mapRef.current?.animateToRegion(region(fresh.coords.latitude, fresh.coords.longitude), 800);
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={SINGAPORE_REGION}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        moveOnMarkerPress={false}
        customMapStyle={MAP_STYLE}
        onRegionChangeComplete={(region) => {
          currentRegionRef.current = region;
        }}
      >
        {filteredVenues.map(venue => (
            <Marker
              key={venue.id}
              coordinate={markerPositions.get(venue.id) ?? { latitude: venue.lat!, longitude: venue.lng! }}
              tracksViewChanges={tracksViewChanges || selectedVenue?.id === venue.id}
              onPress={() => handleMarkerPress(venue)}
              anchor={{ x: 0.5, y: 1 }}
              style={{ backgroundColor: 'transparent' }}
            >
              <MapPin
                venue={venue}
                selected={selectedVenue?.id === venue.id}
                isExpired={isExpiredVenue(venue)}
              />
            </Marker>
          ))
        }
      </MapView>

      {loading && venues.length === 0 && !loadError && (
        <View style={[styles.statusPill, { top: insets.top + 12 }]} pointerEvents="none">
          <ActivityIndicator size="small" color="#6B6B6B" />
          <Text style={styles.statusPillText}>Loading venues…</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
