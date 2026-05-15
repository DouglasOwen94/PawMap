import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Font } from '@/constants/fonts';
import type { Venue } from '@/types/venue';

const SEATING_LABEL: Record<string, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  both: 'Indoor & Outdoor',
};

const STATUS_ORDER: Record<string, number> = { pending: 0, live: 1, rejected: 2 };

function PinGate() {
  const { unlock } = useAdminAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  function handleUnlock() {
    const ok = unlock(pin);
    if (!ok) { setError(true); setPin(''); }
  }

  return (
    <View style={styles.gateContainer}>
      <Ionicons name="shield-outline" size={48} color="#ABABAB" />
      <Text style={styles.gateTitle}>Admin access</Text>
      <TextInput
        value={pin}
        onChangeText={t => { setPin(t); setError(false); }}
        placeholder="Enter PIN"
        placeholderTextColor="#ABABAB"
        keyboardType="number-pad"
        secureTextEntry
        style={[styles.pinInput, error && styles.pinInputError]}
        maxLength={8}
      />
      {error && <Text style={styles.errorText}>Incorrect PIN</Text>}
      <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock} activeOpacity={0.85}>
        <Text style={styles.unlockBtnText}>Unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const { isAdmin, lock } = useAdminAuth();
  const insets = useSafeAreaInsets();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) return;
      setLoading(true);
      supabase
        .from('venues')
        .select('*')
        .in('status', ['pending', 'live'])
        .order('id', { ascending: false })
        .then(({ data, error }) => {
          if (error) console.error('[Admin] fetch error:', JSON.stringify(error));
          if (data) {
            const sorted = [...(data as Venue[])].sort(
              (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
            );
            setVenues(sorted);
          }
          setLoading(false);
        });
    }, [isAdmin])
  );

  if (!isAdmin) return <PinGate />;

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { paddingTop: insets.top + 16 }]}>Venues</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color="#0A0A0A" />
      ) : venues.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="storefront-outline" size={48} color="#ABABAB" />
          <Text style={styles.emptyText}>No venues yet</Text>
        </View>
      ) : (
        <FlatList
          data={venues}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() =>
                router.push({ pathname: '/admin-approve', params: { id: item.id } })
              }
            >
              <View style={styles.cardBody}>
                <Text style={styles.venueName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.venueMeta}>
                  {[item.neighbourhood, SEATING_LABEL[item.seating_type]]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {item.notes && item.status === 'pending' ? (
                  <Text style={styles.venueNotes} numberOfLines={1}>
                    "{item.notes}"
                  </Text>
                ) : null}
              </View>
              <View style={[
                styles.badge,
                item.status === 'pending' ? styles.badgePending : styles.badgeLive,
              ]}>
                <Text style={[
                  styles.badgeText,
                  item.status === 'pending' ? styles.badgeTextPending : styles.badgeTextLive,
                ]}>
                  {item.status === 'pending' ? 'Pending' : 'Live'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ABABAB" />
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.lockBtn} onPress={lock} activeOpacity={0.7}>
        <Text style={styles.lockBtnText}>Lock admin</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  gateContainer: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  gateTitle: {
    fontSize: 20,
    fontFamily: Font.bold,
    color: '#0A0A0A',
    marginTop: 4,
  },
  pinInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 24,
    fontFamily: Font.medium,
    color: '#0A0A0A',
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinInputError: { borderColor: '#EF4444' },
  errorText: { fontSize: 13, fontFamily: Font.regular, color: '#EF4444' },
  unlockBtn: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  unlockBtnText: { fontSize: 15, fontFamily: Font.semiBold, color: '#FFFFFF' },

  container: { flex: 1, backgroundColor: '#F7F7F5' },
  header: {
    fontSize: 22,
    fontFamily: Font.bold,
    color: '#0A0A0A',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  loader: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, fontFamily: Font.regular, color: '#ABABAB' },
  list: { paddingHorizontal: 20 },
  separator: { height: 1, backgroundColor: '#E8E8E4' },
  card: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  cardBody: { flex: 1, gap: 4 },
  venueName: { fontSize: 15, fontFamily: Font.semiBold, color: '#0A0A0A' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
  },
  badgePending: { backgroundColor: '#FFF7ED', borderColor: '#F97316' },
  badgeLive: { backgroundColor: '#F0FDF4', borderColor: '#22C55E' },
  badgeText: { fontSize: 11, fontFamily: Font.semiBold },
  badgeTextPending: { color: '#F97316' },
  badgeTextLive: { color: '#22C55E' },
  venueMeta: { fontSize: 13, fontFamily: Font.regular, color: '#6B6B6B' },
  venueNotes: { fontSize: 12, fontFamily: Font.regular, color: '#ABABAB', fontStyle: 'italic' },
  lockBtn: {
    margin: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  lockBtnText: { fontSize: 14, fontFamily: Font.medium, color: '#6B6B6B' },
});
