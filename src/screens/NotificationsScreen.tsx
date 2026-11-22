import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Notice, PrimaryButton } from '../components/ui';
import { listNotifications, markAllRead, markRead } from '../services/notifications';
import { colors, radius } from '../lib/config';

export default function NotificationsScreen({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setError(null); setItems(await listNotifications()); }
    catch (e: any) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (n: any) => {
    await markRead(n.id);
    if (n.data?.event_id) navigation.navigate('EventDetail', { eventId: n.data.event_id });
    load();
  };
  const readAll = async () => { await markAllRead(); load(); };
  const unread = items.filter(i => !i.read_at).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
        {unread > 0 && (
          <PrimaryButton title={`Mark ${unread} as read`} variant="light" onPress={readAll} style={{ marginTop: 12, height: 44 }} />
        )}
      </View>
      {error ? <Notice text={error} onRetry={load} /> : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={<Notice text="You're all caught up." />}
          renderItem={({ item }) => {
            const isNew = !item.read_at;
            return (
              <Pressable onPress={() => open(item)} style={[s.card, isNew && s.unread]}>
                {isNew && <View style={s.dot} />}
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemTitle, isNew && { color: colors.forest }]}>{item.title}</Text>
                  {!!item.body && <Text style={s.body}>{item.body}</Text>}
                  <Text style={s.time}>
                    {new Date(item.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 10, gap: 10 },
  unread: { borderWidth: 1, borderColor: colors.emerald },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.emerald, marginTop: 6 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  time: { fontSize: 11, color: colors.muted, marginTop: 6 },
});
