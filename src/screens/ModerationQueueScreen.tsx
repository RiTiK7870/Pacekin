import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Notice, PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import { listOpenCases, listOpenAppeals, resolveAppeal } from '../services/moderation';
import { colors, radius } from '../lib/config';

type Tab = 'cases' | 'appeals';
const PRIORITY_COLOR: Record<string, string> = { urgent: colors.danger, high: '#B45309', normal: colors.muted, low: colors.muted };

export default function ModerationQueueScreen({ navigation }: any) {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'admin' || profile?.role === 'moderator';
  const [tab, setTab] = useState<Tab>('cases');
  const [cases, setCases] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [c, a] = await Promise.all([listOpenCases(), listOpenAppeals()]);
      setCases(c);
      setAppeals(a);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { if (isStaff) load(); }, [load, isStaff]));

  if (!isStaff) return <Notice text="The moderation queue is for moderators and admins only." />;

  const decide = async (appealId: string, outcome: 'upheld' | 'overturned') => {
    try {
      await resolveAppeal(appealId, outcome);
      await load();
    } catch (e: any) {
      Alert.alert('Could not resolve appeal', e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Moderation queue</Text>
        <View style={s.tabs}>
          {([['cases', `Reports (${cases.length})`], ['appeals', `Appeals (${appeals.length})`]] as [Tab, string][]).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabOn]}>
              <Text style={[s.tabTxt, tab === key && { color: colors.forest }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Notice text={error} onRetry={load} /> : tab === 'cases' ? (
        <FlatList
          data={cases}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={<Notice text="No open reports. Nice work." />}
          renderItem={({ item: c }) => (
            <Pressable onPress={() => navigation.navigate('ModerationCase', { caseId: c.id })} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={[s.pri, { color: PRIORITY_COLOR[c.priority] }]}>{String(c.priority).toUpperCase()}</Text>
                <Text style={s.name}>{c.category.replace(/_/g, ' ')} · {c.target_type.replace(/_/g, ' ')}</Text>
                <Text style={s.meta}>
                  {new Date(c.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {c.status}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={appeals}
          keyExtractor={a => a.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={<Notice text="No open appeals." />}
          renderItem={({ item: a }) => (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{a.profiles?.full_name ?? a.profiles?.username ?? 'Runner'}</Text>
                <Text style={s.meta}>
                  Original action: {String(a.moderation_actions?.action ?? '').replace(/_/g, ' ')} · {a.moderation_actions?.reason ?? 'no reason given'}
                </Text>
                <Text style={[s.meta, { color: colors.text, marginTop: 6 }]}>"{a.statement}"</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <PrimaryButton title="Overturn" onPress={() => decide(a.id, 'overturned')} style={{ flex: 1, height: 42 }} />
                  <PrimaryButton title="Uphold" variant="outline" onPress={() => decide(a.id, 'upheld')} style={{ flex: 1, height: 42 }} />
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center' },
  tabOn: { backgroundColor: '#fff', borderColor: '#fff' },
  tabTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 10 },
  pri: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 3, textTransform: 'capitalize' },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
});
