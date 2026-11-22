import React, { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Notice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { listPlatformAudit, listEventAudit } from '../services/admin';
import { colors, radius } from '../lib/config';

type Tab = 'platform' | 'events';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const short = (v: unknown) => {
  const text = JSON.stringify(v ?? {});
  return text.length > 140 ? text.slice(0, 137) + '…' : text;
};

export default function AuditLogScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('platform');
  const [platform, setPlatform] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, e] = await Promise.all([listPlatformAudit(), listEventAudit()]);
      setPlatform(p);
      setEvents(e);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { if (profile?.role === 'admin') load(); }, [load, profile?.role]));

  if (profile?.role !== 'admin') return <Notice text="Only the admin can view the audit log." />;

  const q = filter.trim().toLowerCase();
  const rows = tab === 'platform'
    ? platform.filter(r => !q || `${r.action} ${r.target_type} ${r.actor_role}`.toLowerCase().includes(q))
    : events.filter(r => !q || `${r.action} ${r.event_id}`.toLowerCase().includes(q));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Audit log</Text>
        <View style={s.tabs}>
          {([['platform', 'Platform'], ['events', 'Events']] as [Tab, string][]).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabOn]}>
              <Text style={[s.tabTxt, tab === key && { color: colors.forest }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={s.search} value={filter} onChangeText={setFilter} placeholder="Filter by action or target"
          placeholderTextColor={colors.muted} autoCapitalize="none" />
      </View>

      {error ? <Notice text={error} onRetry={load} /> : (
        <FlatList
          data={rows}
          keyExtractor={r => String(r.id)}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={<Notice text="No entries match." />}
          renderItem={({ item: r }) => (
            <View style={s.card}>
              <Text style={s.action}>{String(r.action).replace(/_/g, ' ')}</Text>
              <Text style={s.meta}>
                {when(r.created_at)}
                {tab === 'platform' ? ` · by ${r.actor_role ?? 'system'} · ${r.target_type ?? ''}` : ` · event ${String(r.event_id ?? '').slice(0, 8)}`}
              </Text>
              <Text style={s.details}>
                {tab === 'platform' ? short(r.details) : short(r.changes?.new ?? r.changes)}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center' },
  tabOn: { backgroundColor: '#fff', borderColor: '#fff' },
  tabTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  search: { backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, height: 44, marginTop: 12, fontSize: 14, color: colors.text },
  card: { backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginBottom: 10 },
  action: { fontSize: 14, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  meta: { fontSize: 11, color: colors.muted, marginTop: 4 },
  details: { fontSize: 11, color: colors.text, marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
