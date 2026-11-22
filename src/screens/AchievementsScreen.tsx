import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Notice } from '../components/ui';
import { getAchievements } from '../services/social';
import { fetchStats } from '../services/runs';
import { colors, radius } from '../lib/config';

const pace = (secPerKm: number) => {
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /km`;
};

export default function AchievementsScreen() {
  const [data, setData] = useState<any>(null);
  const [totals, setTotals] = useState<{ km: number; runs: number; streak: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [a, t] = await Promise.all([getAchievements(), fetchStats()]);
      setData(a);
      setTotals(t);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <Notice text={error} onRetry={load} />;
  if (!data || !totals) return <Notice text="Loading achievements…" />;

  const unlocked = data.badges.filter((b: any) => b.unlockedAt).length;
  const records = data.records as any[];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.header}>
          <Text style={s.title}>Achievements</Text>
          <Text style={s.sub}>{unlocked} of {data.badges.length} badges unlocked</Text>
        </View>

        <View style={s.body}>
          <View style={s.statsRow}>
            <Stat label="Total km" value={String(totals.km)} />
            <Stat label="Runs" value={String(totals.runs)} />
            <Stat label="Streak" value={`${data.streak?.current_streak ?? 0}d`} />
            <Stat label="Best streak" value={`${data.streak?.longest_streak ?? 0}d`} />
          </View>

          <Text style={s.section}>Personal records</Text>
          {records.length === 0 ? (
            <Text style={s.copy}>Your records appear after your first verified GPS run.</Text>
          ) : records.map(r => (
            <View key={r.category} style={s.record}>
              <Text style={s.recordLabel}>
                {r.category === 'longest_run_m' ? 'Longest run' : 'Best pace (5K+)'}
              </Text>
              <Text style={s.recordValue}>
                {r.category === 'longest_run_m' ? `${(r.value / 1000).toFixed(2)} km` : pace(Number(r.value))}
              </Text>
            </View>
          ))}

          <Text style={s.section}>Badges</Text>
          <View style={s.grid}>
            {data.badges.map((b: any) => {
              const on = !!b.unlockedAt;
              return (
                <View key={b.code} style={[s.badge, !on && s.badgeLocked]}>
                  <View style={[s.badgeIcon, on ? { backgroundColor: colors.emerald } : { backgroundColor: colors.border }]}>
                    <Ionicons name={(b.icon ?? 'ribbon') as any} size={24} color={on ? '#fff' : colors.muted} />
                  </View>
                  <Text style={[s.badgeName, !on && { color: colors.muted }]}>{b.name}</Text>
                  <Text style={s.badgeDesc}>{b.description}</Text>
                  <Text style={[s.badgeStatus, on && { color: colors.emeraldDeep }]}>
                    {on ? `Unlocked ${new Date(b.unlockedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Locked'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  sub: { color: colors.mint, fontSize: 13, marginTop: 4 },
  body: { padding: 20 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: radius.card, paddingVertical: 14, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.forest },
  statLbl: { fontSize: 11, color: colors.muted, marginTop: 2 },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 24, marginBottom: 10 },
  copy: { color: colors.muted, lineHeight: 20 },
  record: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 10 },
  recordLabel: { color: colors.text, fontWeight: '600' },
  recordValue: { color: colors.forest, fontWeight: '800', fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  badge: { width: '48%', backgroundColor: '#fff', borderRadius: radius.card, padding: 14, alignItems: 'flex-start' },
  badgeLocked: { opacity: 0.8 },
  badgeIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  badgeName: { fontSize: 14, fontWeight: '800', color: colors.text },
  badgeDesc: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 16 },
  badgeStatus: { fontSize: 11, color: colors.muted, marginTop: 8, fontWeight: '700' },
});
