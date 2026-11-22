import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { PrimaryButton, Notice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { listAllEvents } from '../services/adminEvents';
import { colors, radius } from '../lib/config';

const STATUS_COLOR: Record<string, string> = {
  published: colors.emeraldDeep,
  draft: colors.muted,
  unpublished: '#B45309',
  cancelled: colors.danger,
};

export default function AdminEventsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    listAllEvents().then(setEvents).catch(e => setError(e.message));
  }, []));

  if (profile?.role !== 'admin') return <Notice text="Only the owner/admin can manage official events." />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Manage events</Text>
        <PrimaryButton title="New event" variant="light" onPress={() => navigation.navigate('AdminEventForm')} style={{ marginTop: 12 }} />
      </View>
      {error ? <Notice text={error} /> : (
        <FlatList
          data={events}
          keyExtractor={e => e.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={<Notice text="No events yet. Tap New event to create one." />}
          renderItem={({ item }) => (
            <Pressable style={s.card} onPress={() => navigation.navigate('AdminEventForm', { eventId: item.id })}>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{item.title}</Text>
                <Text style={s.meta}>
                  {item.city} · {new Date(item.starts_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={s.meta}>{item.registered_count}/{item.capacity} registered</Text>
              </View>
              <Text style={[s.status, { color: STATUS_COLOR[item.status] ?? colors.muted }]}>
                {String(item.status).toUpperCase()}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  status: { fontSize: 11, fontWeight: '800', marginLeft: 12 },
});
