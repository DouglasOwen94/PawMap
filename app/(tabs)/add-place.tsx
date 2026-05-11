import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSavedVenues } from '@/hooks/useSavedVenues';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { Font } from '@/constants/fonts';

type SeatingType = 'indoor' | 'outdoor' | 'both';
type DogSize     = 'small'  | 'medium'  | 'large' | 'all';
type FieldKey    = 'name' | 'location' | 'seating' | 'dogSize' | 'petMenu';

type AddPlaceForm = {
  name: string;
  neighbourhood: string;
  location: { lat: number; lng: number } | null;
  seating: SeatingType | null;
  dogSize: DogSize | null;
  petMenu: boolean | null;
  notes: string;
};

const INITIAL_FORM: AddPlaceForm = {
  name: '',
  neighbourhood: '',
  location: null,
  seating: null,
  dogSize: null,
  petMenu: null,
  notes: '',
};

const SINGAPORE_REGION = {
  latitude: 1.3521,
  longitude: 103.8198,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

type ChipOption<T> = { v: T; l: string };
type ChipRowProps<T> = {
  options: ChipOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  error?: boolean;
};
function ChipRow<T extends string | number | boolean>({
  options,
  value,
  onChange,
  error,
}: ChipRowProps<T>) {
  return (
    <View style={styles.chipRow}>
      {options.map(opt => {
        const active = opt.v === value;
        return (
          <TouchableOpacity
            key={String(opt.v)}
            onPress={() => onChange(opt.v)}
            activeOpacity={0.75}
            style={[
              styles.chip,
              active && styles.chipActive,
              !active && error && styles.chipError,
            ]}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {opt.l}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AddPlaceScreen() {
  const { showToast } = useSavedVenues();
  const mapRef = useRef<MapView>(null);
  const [form, setForm] = useState<AddPlaceForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<Set<FieldKey>>(new Set());
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [pinTracksViewChanges, setPinTracksViewChanges] = useState(true);

  useEffect(() => {
    if (!form.location) return;
    setPinTracksViewChanges(true);
    const t = setTimeout(() => setPinTracksViewChanges(false), 500);
    return () => clearTimeout(t);
  }, [form.location]);

  function clearError(key: FieldKey) {
    setErrors(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function setField<K extends keyof AddPlaceForm>(key: K, value: AddPlaceForm[K]) {
    setForm(f => ({ ...f, [key]: value }));
    if (key === 'name')     clearError('name');
    if (key === 'location') clearError('location');
    if (key === 'seating')  clearError('seating');
    if (key === 'dogSize')  clearError('dogSize');
    if (key === 'petMenu')  clearError('petMenu');
  }

  function handleMapPress(e: MapPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setField('location', { lat: latitude, lng: longitude });
  }

  async function handleUseMyLocation() {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      Alert.alert('Location off', 'Enable location permission to use this.');
      return;
    }
    setShowUserLocation(true);
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setField('location', { lat: loc.coords.latitude, lng: loc.coords.longitude });
    mapRef.current?.animateToRegion(
      {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600
    );
  }

  function validate(f: AddPlaceForm): Set<FieldKey> {
    const e = new Set<FieldKey>();
    if (!f.name.trim())     e.add('name');
    if (!f.location)        e.add('location');
    if (!f.seating)         e.add('seating');
    if (!f.dogSize)         e.add('dogSize');
    if (f.petMenu === null) e.add('petMenu');
    return e;
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setErrors(new Set());
    mapRef.current?.animateToRegion(SINGAPORE_REGION, 400);
  }

  async function handleSubmit() {
    const next = validate(form);
    if (next.size > 0) {
      setErrors(next);
      Alert.alert('Missing info', 'Please complete the required fields marked in red.');
      return;
    }
    const { error } = await supabase.from('venues').insert({
      name:              form.name.trim(),
      city:              'Singapore',
      neighbourhood:     form.neighbourhood.trim() || null,
      lat:               form.location!.lat,
      lng:               form.location!.lng,
      seating_type:      form.seating,
      dog_sizes_allowed: form.dogSize,
      pet_menu:          form.petMenu!,
      notes:             form.notes.trim() || null,
      status:            'pending',
      indoor_verified:   false,
    });
    if (error) {
      Alert.alert('Something went wrong', 'Please try again.');
      console.error('[AddPlace] Supabase error:', error.message);
      return;
    }
    showToast("Thanks! We'll verify this in person.");
    resetForm();
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.header}>Add a Place</Text>

          <View>
            <FieldLabel>Venue name *</FieldLabel>
            <TextInput
              value={form.name}
              onChangeText={t => setField('name', t)}
              placeholder="e.g., Common Man Coffee Roasters"
              placeholderTextColor="#ABABAB"
              style={[styles.input, errors.has('name') && styles.inputError]}
            />
          </View>

          <View>
            <FieldLabel>Neighbourhood</FieldLabel>
            <TextInput
              value={form.neighbourhood}
              onChangeText={t => setField('neighbourhood', t)}
              placeholder="e.g., Tiong Bahru"
              placeholderTextColor="#ABABAB"
              style={styles.input}
            />
          </View>

          <View>
            <FieldLabel>Location *</FieldLabel>
            <View style={[styles.mapContainer, errors.has('location') && styles.mapContainerError]}>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={SINGAPORE_REGION}
                customMapStyle={MAP_STYLE}
                showsUserLocation={showUserLocation}
                showsMyLocationButton={false}
                showsCompass={false}
                showsPointsOfInterest={false}
                onPress={handleMapPress}
              >
                {form.location && (
                  <Marker
                    coordinate={{
                      latitude: form.location.lat,
                      longitude: form.location.lng,
                    }}
                    tracksViewChanges={pinTracksViewChanges}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View collapsable={false} style={styles.dropPin}>
                      <View style={styles.dropPinDot} />
                    </View>
                  </Marker>
                )}
              </MapView>
              {!form.location && (
                <View style={styles.mapHint} pointerEvents="none">
                  <Text style={styles.mapHintText}>Tap on the map to drop a pin</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={handleUseMyLocation}
              style={styles.outlineBtn}
              activeOpacity={0.75}
            >
              <Text style={styles.outlineBtnText}>Use my current location</Text>
            </TouchableOpacity>
          </View>

          <View>
            <FieldLabel>Seating type *</FieldLabel>
            <ChipRow<SeatingType>
              options={[
                { v: 'indoor',  l: 'Indoor' },
                { v: 'outdoor', l: 'Outdoor' },
                { v: 'both',    l: 'Both' },
              ]}
              value={form.seating}
              onChange={v => setField('seating', v)}
              error={errors.has('seating')}
            />
          </View>

          <View>
            <FieldLabel>Dog sizes allowed *</FieldLabel>
            <ChipRow<DogSize>
              options={[
                { v: 'small',  l: 'Small' },
                { v: 'medium', l: 'Medium' },
                { v: 'large',  l: 'Large' },
                { v: 'all',    l: 'All sizes' },
              ]}
              value={form.dogSize}
              onChange={v => setField('dogSize', v)}
              error={errors.has('dogSize')}
            />
          </View>

          <View>
            <FieldLabel>Pet menu? *</FieldLabel>
            <ChipRow<boolean>
              options={[
                { v: true,  l: 'Yes' },
                { v: false, l: 'No' },
              ]}
              value={form.petMenu}
              onChange={v => setField('petMenu', v)}
              error={errors.has('petMenu')}
            />
          </View>

          <View>
            <FieldLabel>Notes for founder</FieldLabel>
            <TextInput
              value={form.notes}
              onChangeText={t => setField('notes', t)}
              placeholder="Anything we should know? (e.g., access from side gate)"
              placeholderTextColor="#ABABAB"
              multiline
              style={[styles.input, styles.inputMultiline]}
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            style={styles.submitBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>Submit</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    fontSize: 22,
    fontFamily: Font.bold,
    color: '#0A0A0A',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: Font.medium,
    color: '#6B6B6B',
    marginBottom: 6,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Font.regular,
    color: '#1A1A1A',
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
  },

  mapContainer: {
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  mapContainerError: {
    borderColor: '#EF4444',
  },
  mapHint: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  mapHintText: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    color: '#6B6B6B',
    fontSize: 13,
    fontFamily: Font.medium,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    overflow: 'hidden',
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: '#0A0A0A',
    borderColor: '#0A0A0A',
  },
  chipError: {
    borderColor: '#EF4444',
  },
  chipLabel: {
    fontSize: 14,
    fontFamily: Font.medium,
    color: '#1A1A1A',
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },

  outlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  outlineBtnText: {
    fontSize: 14,
    fontFamily: Font.medium,
    color: '#1A1A1A',
  },
  submitBtn: {
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 15,
    fontFamily: Font.semiBold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  dropPin: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  dropPinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
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
