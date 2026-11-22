import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EventCard, Notice } from '../components/ui';
import { listEvents } from '../services/events';
import { CATEGORIES, colors, radius } from '../lib/config';

export default function ExploreScreen({ route, navigation }: any) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>(route?.params?.category);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(useCallback(() => { setRefreshKey(k => k + 1); }, []));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (route?.params?.category) setCategory(route.params.category); }, [route?.params?.category]);

  // Debounced search; RLS guarantees only published events come back.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const ev = await listEvents({ search, category });
        if (alive) { setEvents(ev); setError(null); }
      } catch (e: any) { if (alive) setError(e.message); }
      finally { if (alive) setLoading(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [search, category, refreshKey]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Explore</Text>
        <View style={s.search}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput style={{ flex: 1, marginLeft: 8, fontSize: 16 }} placeholder="Title or city" value={search} onChangeText={setSearch} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {CATEGORIES.map(c => {
            const on = category === c.key;
            return (
              <Pressable key={c.key} onPress={() => setCategory(on ? undefined : c.key)}
                style={[s.chip, on && { backgroundColor: colors.emerald, borderColor: colors.emerald }]}>
                <Text style={[{ color: colors.text, fontWeight: '600' }, on && { color: '#fff' }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {error ? <Notice text={error} /> : (
        <FlatList
          data={events}
          keyExtractor={e => e.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          renderItem={({ item }) => <EventCard event={item} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} />}
          ListEmptyComponent={loading ? null : <Notice text="No published events match your filters." />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 16, height: 50 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: colors.border },
});
