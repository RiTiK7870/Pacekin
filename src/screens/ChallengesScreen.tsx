import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Notice, PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import { listChallenges, joinChallenge, leaveChallenge } from '../services/challenges';
import { colors, radius } from '../lib/config';

const targetLabel = (c: any) =>
  c.metric === 'distance_m'
    ? `${(c.target / 1000).toFixed(c.target % 1000 === 0 ? 0 : 1)} km`
    : `${c.target} run${c.target === 1 ? '' : 's'}`;

const progressLabel = (c: any, p: number) =>
  c.metric === 'distance_m' ? `${(p / 1000).toFixed(1)} km` : `${p} run${p === 1 ? '' : 's'}`;

const daysLeft = (end: string) => Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 864e5));

export default function ChallengesScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await listChallenges());
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (c: any) => {
    setBusyId(c.id);
    try {
      if (c.mine) await leaveChallenge(c.id);
      else await joinChallenge(c);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update challenge', e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Challenges</Text>
        <Text style={s.sub}>Complete a target within the period. Only verified GPS runs count.</Text>
      </View>
      {error ? <Notice text={error} onRetry={load} /> : (
        <FlatList
          data={items}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={<Notice text="No active challenges right now. Check back soon." />}
          renderItem={({ item: c }) => {
            const p = Number(c.mine?.progress ?? 0);
            const pct = Math.min(1, p / Number(c.target));
            const done = !!c.mine?.completed_at;
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.name}>{c.title}</Text>
                  <Text style={s.target}>{targetLabel(c)}</Text>
                </View>
                {!!c.description && <Text style={s.desc}>{c.description}</Text>}
                <Text style={s.meta}>
                  {new Date(c.period_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  {' – '}
                  {new Date(c.period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  {' · '}{daysLeft(c.period_end)} days left
                </Text>
                {c.mine && (
                  <>
                    <View style={s.track}><View style={[s.fill, { width: `${pct * 100}%` }]} /></View>
                    <Text style={s.progress}>{progressLabel(c, p)} of {targetLabel(c)}{done ? ' · Completed' : ''}</Text>
                  </>
                )}
                <PrimaryButton
                  title={c.mine ? (done ? 'Joined · completed' : 'Leave challenge') : 'Join challenge'}
                  variant={c.mine ? 'outline' : 'solid'}
                  disabled={busyId === c.id || (!!c.mine && done)}
                  loading={busyId === c.id}
                  onPress={() => toggle(c)}
                  style={{ marginTop: 14 }} />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  sub: { color: colors.mint, fontSize: 13, marginTop: 4, lineHeight: 18 },
  card: { backgroundColor: '#fff', borderRadius: radius.card, padding: 18, marginBottom: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text, flex: 1 },
  target: { fontSize: 14, fontWeight: '800', color: colors.emeraldDeep },
  desc: { color: colors.muted, marginTop: 6, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 8 },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 14, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.emerald },
  progress: { color: colors.text, fontSize: 13, marginTop: 6, fontWeight: '600' },
});
