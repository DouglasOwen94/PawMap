import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useSavedVenues } from '@/hooks/useSavedVenues';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Font } from '@/constants/fonts';

type SeatingType = 'indoor' | 'outdoor' | 'both';
type DogSize     = 'small'  | 'medium'  | 'large' | 'all';
type FieldKey    = 'name' | 'neighbourhood' | 'seating' | 'dogSize' | 'petMenu';

type AddPlaceForm = {
  name: string;
  neighbourhood: string;
  address: string;
  seating: SeatingType | null;
  dogSize: DogSize | null;
  petMenu: boolean | null;
  leashFree: boolean | null;
  notes: string;
};

const INITIAL_FORM: AddPlaceForm = {
  name: '',
  neighbourhood: '',
  address: '',
  seating: null,
  dogSize: null,
  petMenu: null,
  leashFree: null,
  notes: '',
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
function ChipRow<T extends string | number | boolean>({ options, value, onChange, error }: ChipRowProps<T>) {
  return (
    <View style={styles.chipRow}>
      {options.map(opt => {
        const active = opt.v === value;
        return (
          <TouchableOpacity
            key={String(opt.v)}
            onPress={() => onChange(opt.v)}
            activeOpacity={0.75}
            style={[styles.chip, active && styles.chipActive, !active && error && styles.chipError]}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.l}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AddPlaceScreen() {
  const { showToast } = useSavedVenues();

  const [form, setForm] = useState<AddPlaceForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<Set<FieldKey>>(new Set());

  useFocusEffect(useCallback(() => {
    return () => { setForm(INITIAL_FORM); setErrors(new Set()); };
  }, []));

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
    if (key === 'name')         clearError('name');
    if (key === 'neighbourhood') clearError('neighbourhood');
    if (key === 'seating')      clearError('seating');
    if (key === 'dogSize')      clearError('dogSize');
    if (key === 'petMenu')      clearError('petMenu');
  }

  function validate(f: AddPlaceForm): Set<FieldKey> {
    const e = new Set<FieldKey>();
    if (!f.name.trim())         e.add('name');
    if (!f.neighbourhood.trim()) e.add('neighbourhood');
    if (!f.seating)             e.add('seating');
    if (!f.dogSize)             e.add('dogSize');
    if (f.petMenu === null)     e.add('petMenu');
    return e;
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setErrors(new Set());
  }

  async function handleSubmit() {
    const next = validate(form);
    if (next.size > 0) {
      setErrors(next);
      Alert.alert('Missing info', 'Please complete the required fields marked in red.');
      return;
    }

    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch {
      // GPS unavailable — lat/lng remain null, founder geocodes via dashboard
    }

    const { error } = await supabase.from('venues').insert({
      name:              form.name.trim(),
      city:              'Singapore',
      neighbourhood:     form.neighbourhood.trim(),
      address:           form.address.trim() || null,
      lat,
      lng,
      seating_type:      form.seating,
      dog_sizes_allowed: form.dogSize,
      pet_menu:          form.petMenu!,
      leash_free:        form.leashFree,
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              maxLength={100}
              style={[styles.input, errors.has('name') && styles.inputError]}
            />
          </View>

          <View>
            <FieldLabel>Neighbourhood *</FieldLabel>
            <TextInput
              value={form.neighbourhood}
              onChangeText={t => setField('neighbourhood', t)}
              placeholder="e.g., Tiong Bahru"
              placeholderTextColor="#ABABAB"
              maxLength={60}
              style={[styles.input, errors.has('neighbourhood') && styles.inputError]}
            />
          </View>

          <View>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { marginBottom: 0 }]}>Address</Text>
              <Text style={styles.optionalTag}>optional</Text>
            </View>
            <TextInput
              value={form.address}
              onChangeText={t => setField('address', t)}
              placeholder="e.g., 78 Moh Guan Terrace, #01-20"
              placeholderTextColor="#ABABAB"
              maxLength={200}
              style={styles.input}
            />
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
            <FieldLabel>Leash-free area?</FieldLabel>
            <ChipRow<boolean>
              options={[
                { v: true,  l: 'Yes' },
                { v: false, l: 'No' },
              ]}
              value={form.leashFree}
              onChange={v => setField('leashFree', v)}
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
              maxLength={500}
              style={[styles.input, styles.inputMultiline]}
            />
          </View>

          <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn} activeOpacity={0.85}>
            <Text style={styles.submitBtnText}>Submit</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F7F7F5' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, gap: 16 },
  header:        { fontSize: 22, fontFamily: Font.bold, color: '#0A0A0A', marginBottom: 4 },
  label:         { fontSize: 13, fontFamily: Font.medium, color: '#6B6B6B', marginBottom: 6 },

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
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  inputError:     { borderColor: '#EF4444' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    backgroundColor: '#FFFFFF',
  },
  chipActive:      { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  chipError:       { borderColor: '#EF4444' },
  chipLabel:       { fontSize: 14, fontFamily: Font.medium, color: '#1A1A1A' },
  chipLabelActive: { color: '#FFFFFF' },

  labelRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  optionalTag: { fontSize: 11, fontFamily: Font.regular, color: '#ABABAB' },

  submitBtn:     { backgroundColor: '#0A0A0A', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontSize: 15, fontFamily: Font.semiBold, color: '#FFFFFF', letterSpacing: 0.2 },
});
