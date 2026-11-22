import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Notice } from '../components/ui';
import { getLeaderboard, Period } from '../services/social';
import { colors, radius } from '../lib/config';

const PERIODS: [Period, string][] = [
  ['daily', 'Today'],
  ['weekly', 'Week'],
  ['monthly', 'Month'],
  ['all_time', 'All time'],
];
const RANK_COLORS = ['#D4AF37', '#9CA3AF', '#B45309'];

const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

export default function LeaderboardScreen() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setRows(await getLeaderboard(period));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const first = rows[0];
  const range = first && period !== 'all_time'
    ? `${shortDate(new Date(first.period_start))} – ${shortDate(new Date(new Date(first.period_end).getTime() - 1))}`
    : period === 'all_time' ? 'All verified runs' : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Leaderboard</Text>
        <Text style={s.sub}>Verified GPS distance · {range || 'Loading…'}</Text>
        <View style={s.periods}>
          {PERIODS.map(([key, label]) => (
            <Pressable key={key} onPress={() => setPeriod(key)} style={[s.periodPill, period === key && s.periodOn]}>
              <Text style={[s.periodTxt, period === key && { color: colors.forest }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Notice text={error} onRetry={load} /> : (
        <FlatList
          data={rows}
          keyExtractor={r => String(r.rank_no)}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={!loading ? <Notice text="No verified runs in this period yet. Record a GPS run to appear here." /> : null}
          renderItem={({ item }) => {
            const medal = item.rank_no <= 3 ? RANK_COLORS[item.rank_no - 1] : null;
            return (
              <View style={[s.row, item.is_me && s.me]}>
                <View style={[s.rank, medal && { backgroundColor: medal }]}>
                  <Text style={[s.rankTxt, medal && { color: '#fff' }]}>{item.rank_no}</Text>
                </View>
                <View style={s.avatar}>
                  {item.avatar_url
                    ? <Image source={{ uri: item.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
                    : <Text style={s.avatarTxt}>{(item.display_name ?? '?').charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{item.display_name}{item.is_me ? '  (you)' : ''}</Text>
                </View>
                <Text style={s.km}>{(item.total_distance_m / 1000).toFixed(1)} km</Text>
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
  sub: { color: colors.mint, fontSize: 13, marginTop: 4 },
  periods: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  periodPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  periodOn: { backgroundColor: '#fff', borderColor: '#fff' },
  periodTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: 'transparent' },
  me: { borderColor: colors.emerald, backgroundColor: colors.mint },
  rank: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  rankTxt: { fontWeight: '800', color: colors.text },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarTxt: { color: '#fff', fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  km: { fontSize: 15, fontWeight: '800', color: colors.forest },
});
