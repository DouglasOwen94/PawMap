import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Font } from '@/constants/fonts';
import type { Venue } from '@/types/venue';

type SeatingType = 'indoor' | 'outdoor' | 'both';
type DogSize = 'small' | 'medium' | 'large' | 'all';

type FormState = {
  name: string;
  neighbourhood: string;
  lat: string;
  lng: string;
  seating_type: SeatingType;
  dog_sizes_allowed: DogSize;
  pet_menu: boolean;
  indoor_verified: boolean;
  google_place_id: string;
};

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ChipRow<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: { v: T; l: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map(opt => {
        const active = opt.v === value;
        return (
          <TouchableOpacity
            key={String(opt.v)}
            onPress={() => onChange(opt.v)}
            activeOpacity={0.75}
            style={[styles.chip, active && styles.chipActive]}
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

export default function AdminApproveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    supabase
      .from('venues')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const v = data as Venue;
          setVenue(v);
          setForm({
            name: v.name,
            neighbourhood: v.neighbourhood ?? '',
            lat: String(v.lat),
            lng: String(v.lng),
            seating_type: v.seating_type,
            dog_sizes_allowed: v.dog_sizes_allowed,
            pet_menu: v.pet_menu,
            indoor_verified: v.indoor_verified,
            google_place_id: v.google_place_id ?? '',
          });
        }
        setLoading(false);
      });
  }, [id]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => (f ? { ...f, [key]: value } : f));
  }

  function buildPayload(form: FormState, isApproving: boolean) {
    const today = new Date().toISOString().split('T')[0];
    return {
      name: form.name.trim(),
      neighbourhood: form.neighbourhood.trim() || null,
      lat: parseFloat(form.lat) || venue!.lat,
      lng: parseFloat(form.lng) || venue!.lng,
      seating_type: form.seating_type,
      dog_sizes_allowed: form.dog_sizes_allowed,
      pet_menu: form.pet_menu,
      indoor_verified: form.indoor_verified,
      google_place_id: form.google_place_id.trim() || null,
      ...(isApproving
        ? { status: 'live', last_verified_date: today }
        : { last_verified_date: today }),
    };
  }

  async function handleSave(isApproving: boolean) {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from('venues')
      .update(buildPayload(form, isApproving))
      .eq('id', id);
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not save. Try again.\n' + error.message);
      return;
    }
    router.back();
  }

  async function handleReject() {
    Alert.alert(
      'Reject submission?',
      'This marks the venue as rejected and removes it from the queue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            await supabase.from('venues').update({ status: 'rejected' }).eq('id', id);
            setSaving(false);
            router.back();
          },
        },
      ]
    );
  }

  if (loading || !form || !venue) {
    return <ActivityIndicator style={{ flex: 1, backgroundColor: '#F7F7F5' }} color="#0A0A0A" />;
  }

  const isPending = venue.status === 'pending';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {venue.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Submitter notes</Text>
            <Text style={styles.notesText}>{venue.notes}</Text>
          </View>
        ) : null}

        <View>
          <FieldLabel>Venue name</FieldLabel>
          <TextInput
            value={form.name}
            onChangeText={t => setField('name', t)}
            style={styles.input}
            placeholderTextColor="#ABABAB"
          />
        </View>

        <View>
          <FieldLabel>Neighbourhood</FieldLabel>
          <TextInput
            value={form.neighbourhood}
            onChangeText={t => setField('neighbourhood', t)}
            placeholder="e.g. Tiong Bahru"
            placeholderTextColor="#ABABAB"
            style={styles.input}
          />
        </View>

        <View>
          <FieldLabel>Location (lat / lng)</FieldLabel>
          <View style={styles.row}>
            <TextInput
              value={form.lat}
              onChangeText={t => setField('lat', t)}
              placeholder="Latitude"
              placeholderTextColor="#ABABAB"
              keyboardType="decimal-pad"
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              value={form.lng}
              onChangeText={t => setField('lng', t)}
              placeholder="Longitude"
              placeholderTextColor="#ABABAB"
              keyboardType="decimal-pad"
              style={[styles.input, styles.halfInput]}
            />
          </View>
        </View>

        <View>
          <FieldLabel>Seating type</FieldLabel>
          <ChipRow<SeatingType>
            options={[
              { v: 'indoor', l: 'Indoor' },
              { v: 'outdoor', l: 'Outdoor' },
              { v: 'both', l: 'Both' },
            ]}
            value={form.seating_type}
            onChange={v => setField('seating_type', v)}
          />
        </View>

        <View>
          <FieldLabel>Dog sizes allowed</FieldLabel>
          <ChipRow<DogSize>
            options={[
              { v: 'small', l: 'Small' },
              { v: 'medium', l: 'Medium' },
              { v: 'large', l: 'Large' },
              { v: 'all', l: 'All sizes' },
            ]}
            value={form.dog_sizes_allowed}
            onChange={v => setField('dog_sizes_allowed', v)}
          />
        </View>

        <View>
          <FieldLabel>Pet menu?</FieldLabel>
          <ChipRow<boolean>
            options={[{ v: true, l: 'Yes' }, { v: false, l: 'No' }]}
            value={form.pet_menu}
            onChange={v => setField('pet_menu', v)}
          />
        </View>

        <View>
          <FieldLabel>Indoor verified?</FieldLabel>
          <ChipRow<boolean>
            options={[{ v: true, l: 'Yes' }, { v: false, l: 'No' }]}
            value={form.indoor_verified}
            onChange={v => setField('indoor_verified', v)}
          />
        </View>

        <View>
          <FieldLabel>Google Place ID (optional)</FieldLabel>
          <TextInput
            value={form.google_place_id}
            onChangeText={t => setField('google_place_id', t)}
            placeholder="ChIJ..."
            placeholderTextColor="#ABABAB"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {isPending ? (
          <>
            <TouchableOpacity
              style={[styles.approveBtn, saving && styles.btnDisabled]}
              onPress={() => handleSave(true)}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.approveBtnText}>{saving ? 'Saving…' : 'Approve & publish'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, saving && styles.btnDisabled]}
              onPress={handleReject}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.approveBtn, saving && styles.btnDisabled]}
            onPress={() => handleSave(false)}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.approveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  notesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    padding: 14,
    gap: 4,
  },
  notesLabel: {
    fontSize: 11,
    fontFamily: Font.semiBold,
    color: '#ABABAB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: { fontSize: 14, fontFamily: Font.regular, color: '#1A1A1A' },
  label: { fontSize: 13, fontFamily: Font.medium, color: '#6B6B6B', marginBottom: 6 },
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
  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  chipLabel: { fontSize: 14, fontFamily: Font.medium, color: '#1A1A1A' },
  chipLabelActive: { color: '#FFFFFF' },
  approveBtn: {
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  approveBtnText: { fontSize: 15, fontFamily: Font.semiBold, color: '#FFFFFF', letterSpacing: 0.2 },
  rejectBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  rejectBtnText: { fontSize: 15, fontFamily: Font.semiBold, color: '#EF4444' },
  btnDisabled: { opacity: 0.5 },
});
