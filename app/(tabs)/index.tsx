import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { FilterChips, type FilterKey } from '@/components/FilterChips';
import { MapPin } from '@/components/MapPin';
import { VenueBottomSheet } from '@/components/VenueBottomSheet';
import { DUMMY_VENUES } from '@/constants/dummyVenues';
import { isExpiredVenue, MS_PER_DAY, VERIFIED_DAYS } from '@/utils/venue';
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
      if (!venue.indoor_verified || !venue.indoor_photo_url || !venue.last_verified_date) return false;
      if (isExpiredVenue(venue)) return false;
      const age = (Date.now() - new Date(venue.last_verified_date).getTime()) / MS_PER_DAY;
      return age <= VERIFIED_DAYS;
    }
    case 'Outdoor':
      return venue.seating_type === 'outdoor' || venue.seating_type === 'both';
    case 'Open Now': {
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
  }
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All');
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  useEffect(() => {
    checkLocationPermission();
    // 3 s gives Android time to load network images before freezing the bitmap
    const timer = setTimeout(() => setTracksViewChanges(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  function handleFilterSelect(filter: FilterKey) {
    setActiveFilter(filter);
    setTracksViewChanges(true);
    setTimeout(() => setTracksViewChanges(false), 500);
  }

  function handleMarkerPress(venue: Venue) {
    setSelectedVenue(venue);
    // Re-enable view tracking briefly so Android captures the selected-state animation
    setTracksViewChanges(true);
    setTimeout(() => setTracksViewChanges(false), 600);
  }

  function handleSheetClose() {
    setSelectedVenue(null);
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
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    mapRef.current?.animateToRegion(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      800
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={SINGAPORE_REGION}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        customMapStyle={MAP_STYLE}
        onRegionChangeComplete={() => {
          setTracksViewChanges(true);
          setTimeout(() => setTracksViewChanges(false), 600);
        }}
      >
        {DUMMY_VENUES
          .filter(venue => venueMatchesFilter(venue, activeFilter) && !isExpiredVenue(venue))
          .map(venue => (
            <Marker
              key={venue.id}
              coordinate={{ latitude: venue.lat, longitude: venue.lng }}
              tracksViewChanges={tracksViewChanges}
              onPress={() => handleMarkerPress(venue)}
              anchor={{ x: 0.5, y: 1 }}
              style={{ backgroundColor: 'transparent' }}
            >
              <MapPin
                venue={venue}
                selected={selectedVenue?.id === venue.id}
              />
            </Marker>
          ))
        }
      </MapView>

      <FilterChips active={activeFilter} onSelect={handleFilterSelect} />

      <VenueBottomSheet venue={selectedVenue} onClose={handleSheetClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
