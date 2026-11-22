import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Notice, PrimaryButton } from '../components/ui';
import DateTimeField from '../components/DateTimeField';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import { adminListChallenges, saveChallenge, Metric } from '../services/challenges';
import { colors, radius } from '../lib/config';

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 0); return x; };
const STATUSES = ['draft', 'active', 'closed'] as const;
type Status = typeof STATUSES[number];

type Draft = {
  id: string | null; title: string; description: string; metric: Metric; target: string;
  start: Date; end: Date; status: Status;
};
const blank = (): Draft => {
  const start = startOfDay(new Date());
  const end = startOfDay(new Date(Date.now() + 6 * 864e5));
  return { id: null, title: '', description: '', metric: 'distance_m', target: '10', start, end, status: 'active' };
};

export default function AdminChallengesScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setError(null); setItems(await adminListChallenges()); }
    catch (e: any) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (profile?.role !== 'admin') return <Notice text="Only the owner/admin can manage challenges." />;

  const edit = (c: any) => setDraft({
    id: c.id,
    title: c.title,
    description: c.description ?? '',
    metric: c.metric,
    target: c.metric === 'distance_m' ? String(c.target / 1000) : String(c.target),
    start: new Date(c.period_start),
    end: new Date(c.period_end),
    status: c.status,
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => (d ? { ...d, [k]: v } : d));

  const save = async () => {
    if (!draft) return;
    const target = draft.metric === 'distance_m' ? parseFloat(draft.target) * 1000 : parseInt(draft.target, 10);
    if (draft.title.trim().length < 3) return Alert.alert('Title', 'Please enter a title of at least 3 characters.');
    if (!(target > 0)) return Alert.alert('Target', 'Enter a target greater than zero.');
    if (draft.end.getTime() <= draft.start.getTime()) return Alert.alert('Dates', 'The end date must be after the start date.');
    setBusy(true);
    try {
      await saveChallenge(draft.id, {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        metric: draft.metric,
        target,
        period_start: startOfDay(draft.start).toISOString(),
        period_end: endOfDay(draft.end).toISOString(),
        status: draft.status,
      });
      setDraft(null);
      await load();
    } catch (e: any) {
      Alert.alert('Could not save challenge', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Manage challenges</Text>
        <PrimaryButton
          title={draft ? 'Close form' : 'New challenge'}
          variant="light"
          onPress={() => setDraft(draft ? null : blank())}
          style={{ marginTop: 12, height: 46 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {draft && (
          <View style={s.form}>
            <Text style={s.section}>{draft.id ? 'Edit challenge' : 'New challenge'}</Text>
            <Text style={s.label}>Title</Text>
            <TextInput style={s.input} value={draft.title} onChangeText={v => set('title', v)} placeholder="May 10K Challenge" maxLength={120} />
            <Text style={s.label}>Description</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} multiline value={draft.description} onChangeText={v => set('description', v)} />

            <Text style={s.label}>Target type</Text>
            <View style={s.row}>
              <Pill label="Distance (km)" active={draft.metric === 'distance_m'} onPress={() => set('metric', 'distance_m')} />
              <Pill label="Number of runs" active={draft.metric === 'runs'} onPress={() => set('metric', 'runs')} />
            </View>
            <Text style={s.label}>{draft.metric === 'distance_m' ? 'Target distance (km)' : 'Target runs'}</Text>
            <TextInput style={s.input} keyboardType="decimal-pad" value={draft.target} onChangeText={v => set('target', v)} />

            <DateTimeField label="Starts" value={draft.start} dateOnly minimumDate={new Date(2020, 0, 1)} onChange={d => set('start', d)} />
            <DateTimeField label="Ends" value={draft.end} dateOnly minimumDate={new Date(2020, 0, 1)} onChange={d => set('end', d)} />

            <Text style={s.label}>Status</Text>
            <View style={s.row}>
              {STATUSES.map(st => <Pill key={st} label={st} active={draft.status === st} onPress={() => set('status', st)} />)}
            </View>
            <PrimaryButton title="Save challenge" onPress={save} loading={busy} style={{ marginTop: 20 }} />
          </View>
        )}

        {error ? <Notice text={error} onRetry={load} /> : items.map(c => (
          <Pressable key={c.id} onPress={() => edit(c)} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{c.title}</Text>
              <Text style={s.meta}>
                {c.metric === 'distance_m' ? `${(c.target / 1000).toFixed(1)} km` : `${c.target} runs`} ·{' '}
                {new Date(c.period_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} –{' '}
                {new Date(c.period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </Text>
            </View>
            <Text style={[s.status, c.status === 'active' && { color: colors.emeraldDeep }]}>{String(c.status).toUpperCase()}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.pill, active && s.pillOn]}>
      <Text style={[s.pillTxt, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  form: { backgroundColor: '#fff', borderRadius: radius.card, padding: 18, marginBottom: 18 },
  section: { fontSize: 17, fontWeight: '800', color: colors.forest, marginBottom: 4 },
  label: { fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: colors.bg, borderRadius: radius.btn, borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  pillOn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  pillTxt: { color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 10, gap: 10 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  status: { fontSize: 11, fontWeight: '800', color: colors.muted },
});
