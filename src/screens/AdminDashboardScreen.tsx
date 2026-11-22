import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Notice, PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../services/admin';
import { colors, radius } from '../lib/config';

export default function AdminDashboardScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [m, setM] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setError(null); setM(await getDashboard()); }
    catch (e: any) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { if (profile?.role === 'admin') load(); }, [load, profile?.role]));

  if (profile?.role !== 'admin') return <Notice text="Only the admin can open the dashboard." />;
  if (error) return <Notice text={error} onRetry={load} />;
  if (!m) return <Notice text="Loading dashboard…" />;

  const tiles: [string, number, string?][] = [
    ['Runners', m.runners],
    ['New today', m.newToday],
    ['Live events', m.events],
    ['Upcoming events', m.upcoming],
    ['Confirmed sign-ups', m.registrations],
    ['Active groups', m.groups],
    ['Open reports', m.reports, m.reports > 0 ? 'needs review' : undefined],
    ['Open cases', m.cases],
    ['Open appeals', m.appeals],
    ['Suspended accounts', m.suspended],
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Dashboard</Text>
        <Text style={s.sub}>Platform overview · updated just now</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={s.grid}>
          {tiles.map(([label, value, hint]) => (
            <View key={label} style={s.tile}>
              <Text style={s.value}>{value.toLocaleString('en-IN')}</Text>
              <Text style={s.label}>{label}</Text>
              {!!hint && <Text style={s.hint}>{hint}</Text>}
            </View>
          ))}
        </View>
        <Text style={s.note}>Run totals and per-runner data are private to each runner, so they aren't shown here.</Text>
        <View style={{ gap: 10, marginTop: 16 }}>
          <PrimaryButton title="Open audit log" variant="outline" onPress={() => navigation.navigate('AuditLog')} />
          <PrimaryButton title="Manage events" variant="outline" onPress={() => navigation.navigate('AdminEvents')} />
          <PrimaryButton title="Moderation queue" variant="outline" onPress={() => navigation.navigate('ModerationQueue')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  sub: { color: colors.mint, fontSize: 13, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  tile: { width: '48%', backgroundColor: '#fff', borderRadius: radius.card, padding: 16 },
  value: { fontSize: 24, fontWeight: '800', color: colors.forest },
  label: { fontSize: 12, color: colors.muted, marginTop: 4 },
  hint: { fontSize: 11, color: colors.danger, marginTop: 4, fontWeight: '700' },
  note: { fontSize: 12, color: colors.muted, marginTop: 14, lineHeight: 17 },
});
