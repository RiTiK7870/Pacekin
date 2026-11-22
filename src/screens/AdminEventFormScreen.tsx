import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, Notice } from '../components/ui';
import DateTimeField from '../components/DateTimeField';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import { getEvent, saveEvent, uploadEventCover } from '../services/adminEvents';
import { CATEGORIES, colors, radius } from '../lib/config';

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];
const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);
const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(6, 0, 0, 0);
  return d;
};

type PrizeDraft = { type: 'cash' | 'other'; amount: string; label: string };
const ordinal = (n: number) => ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`;

type Form = {
  title: string; description: string; category: string; distance: string; difficulty: string;
  city: string; meetingPoint: string; capacity: string; waitlist: boolean; facilities: string;
  starts: Date; regCloses: Date; ends: Date;
};

export default function AdminEventFormScreen({ route, navigation }: any) {
  const eventId: string | null = route?.params?.eventId ?? null;
  const { profile } = useAuth();
  const [status, setStatus] = useState<string>('draft');
  const [loading, setLoading] = useState<boolean>(!!eventId);
  const [busy, setBusy] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);   // already uploaded
  const [coverUri, setCoverUri] = useState<string | null>(null);   // picked, not yet uploaded
  const [isPaid, setIsPaid] = useState(false);
  const [fee, setFee] = useState('');
  const [winnersText, setWinnersText] = useState('0');
  const [prizes, setPrizes] = useState<PrizeDraft[]>([]);
  const [featured, setFeatured] = useState(false);
  const [form, setForm] = useState<Form>(() => {
    const starts = defaultStart();
    return {
      title: '', description: '', category: '5k', distance: '5', difficulty: 'Beginner',
      city: '', meetingPoint: '', capacity: '30', waitlist: false, facilities: '',
      starts, regCloses: addHours(starts, -1), ends: addHours(starts, 2),
    };
  });

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }));

  const pickStart = (d: Date) => {
    if (d.getTime() <= Date.now()) return Alert.alert('Start time', 'Choose a start time in the future.');
    setForm(f => ({
      ...f,
      starts: d,
      ends: f.ends.getTime() <= d.getTime() ? addHours(d, 2) : f.ends,
      regCloses: f.regCloses.getTime() >= d.getTime() ? addHours(d, -1) : f.regCloses,
    }));
  };
  const pickEnds = (d: Date) => {
    if (d.getTime() <= form.starts.getTime()) return Alert.alert('End time', 'End time must be after the start time.');
    set('ends', d);
  };
  const pickRegCloses = (d: Date) => {
    if (d.getTime() >= form.starts.getTime()) return Alert.alert('Registration', 'Registration must close before the event starts.');
    set('regCloses', d);
  };

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Photos access', 'Allow photo access to add a cover image.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) setCoverUri(result.assets[0].uri);
  };

  const removeCover = () => { setCoverUri(null); setCoverUrl(null); };

  useEffect(() => {
    if (!eventId) return;
    getEvent(eventId)
      .then((e: any) => {
        const starts = new Date(e.starts_at);
        setStatus(e.status);
        setCoverUrl(e.cover_url ?? null);
        setIsPaid(!!e.is_paid);
        setFeatured(!!e.featured);
        setFee(e.entry_fee ? String(e.entry_fee) : '');
        setWinnersText(String(e.prize_winners ?? 0));
        setPrizes((e.prizes ?? []).map((p: any) => ({
          type: p.type === 'other' ? 'other' : 'cash',
          amount: p.amount ? String(p.amount) : '',
          label: p.label ?? '',
        })));
        setForm({
          title: e.title ?? '',
          description: e.description ?? '',
          category: e.category ?? '5k',
          distance: String(e.distance_km ?? ''),
          difficulty: e.difficulty ?? 'Beginner',
          city: e.city ?? '',
          meetingPoint: e.meeting_point ?? '',
          capacity: String(e.capacity),
          waitlist: !!e.waitlist_enabled,
          facilities: (e.facilities ?? []).join(', '),
          starts,
          regCloses: new Date(e.reg_closes_at ?? e.starts_at),
          ends: new Date(e.ends_at ?? addHours(starts, 2)),
        });
      })
      .catch((e: any) => Alert.alert('Could not load event', e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  const validate = (isNew: boolean): string | null => {
    if (form.title.trim().length < 3) return 'Title must be at least 3 characters.';
    if (!form.city.trim()) return 'City is required.';
    const cap = parseInt(form.capacity, 10);
    if (!cap || cap < 1) return 'Capacity must be at least 1.';
    if (isNew && form.starts.getTime() <= Date.now()) return 'Start time must be in the future.';
    if (form.regCloses.getTime() > form.starts.getTime()) return 'Registration must close before the event starts.';
    if (form.ends.getTime() <= form.starts.getTime()) return 'End time must be after the start time.';
    if (isPaid) {
      if (!(parseFloat(fee) > 0)) return 'Entry fee must be more than ₹0 for a paid event.';
      const n = parseInt(winnersText, 10) || 0;
      for (let i = 0; i < n; i++) {
        const p = prizes[i];
        if (!p) return `Add details for the ${ordinal(i + 1)} prize.`;
        if (p.type === 'cash' && !(parseFloat(p.amount) > 0)) return `Enter the cash amount for the ${ordinal(i + 1)} prize.`;
        if (p.type === 'other' && !p.label.trim()) return `Describe the ${ordinal(i + 1)} prize (e.g. trophy, voucher).`;
      }
    }
    return null;
  };

  const payload = (next: string, cover: string | null) => ({
    title: form.title.trim(),
    description: form.description.trim() || null,
    category: form.category,
    distance_km: parseFloat(form.distance) || null,
    difficulty: form.difficulty,
    city: form.city.trim(),
    meeting_point: form.meetingPoint.trim() || null,
    capacity: parseInt(form.capacity, 10),
    waitlist_enabled: form.waitlist,
    facilities: form.facilities.split(',').map(x => x.trim()).filter(Boolean),
    starts_at: form.starts.toISOString(),
    reg_closes_at: form.regCloses.toISOString(),
    ends_at: form.ends.toISOString(),
    cover_url: cover,
    featured,
    is_paid: isPaid,
    entry_fee: isPaid ? parseFloat(fee) : null,
    prize_winners: isPaid ? (parseInt(winnersText, 10) || 0) : 0,
    prizes: isPaid
      ? prizes.slice(0, parseInt(winnersText, 10) || 0).map((p, i) => ({
          place: i + 1,
          type: p.type,
          amount: p.type === 'cash' ? parseFloat(p.amount) : null,
          label: p.type === 'other' ? p.label.trim() : null,
        }))
      : [],
    status: next,
    ...(next === 'published' && status !== 'published' ? { published_at: new Date().toISOString() } : {}),
  });

  const save = async (next: string) => {
    const err = validate(!eventId);
    if (err) return Alert.alert('Check the form', err);
    setBusy(true);
    try {
      const cover = coverUri ? await uploadEventCover(coverUri) : coverUrl;
      await saveEvent(eventId, payload(next, cover));
      Alert.alert(next === 'published' ? 'Event published' : 'Saved');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelEvent = () => Alert.alert(
    'Cancel this event?',
    'Runners who joined will be notified.',
    [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await saveEvent(eventId, {
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancel_reason: 'Cancelled by organiser',
            });
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Could not cancel', e.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  if (loading) return <Notice text="Loading event…" />;
  if (profile?.role !== 'admin') return <Notice text="Only the owner/admin can manage official events." />;

  const shownCover = coverUri ?? coverUrl;

  const setWinners = (text: string) => {
    setWinnersText(text);
    const n = Math.min(10, Math.max(0, parseInt(text, 10) || 0));
    setPrizes(p => Array.from({ length: n }, (_, i) => p[i] ?? { type: 'cash', amount: '', label: '' }));
  };
  const updatePrize = (i: number, patch: Partial<PrizeDraft>) =>
    setPrizes(p => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={s.section}>Cover photo</Text>
        <Pressable onPress={pickCover} style={s.cover} accessibilityRole="button">
          {shownCover ? (
            <Image source={{ uri: shownCover }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View style={s.coverEmpty}>
              <Ionicons name="image-outline" size={34} color={colors.forest} />
              <Text style={{ color: colors.muted, marginTop: 6 }}>Tap to add a cover photo</Text>
            </View>
          )}
        </Pressable>
        {shownCover && (
          <View style={s.coverActions}>
            <Pressable onPress={pickCover}><Text style={s.link}>Change photo</Text></Pressable>
            <Pressable onPress={removeCover}><Text style={[s.link, { color: colors.danger }]}>Remove</Text></Pressable>
          </View>
        )}

        <Text style={s.section}>Basics</Text>
        <Text style={s.label}>Title</Text>
        <TextInput style={s.input} value={form.title} onChangeText={v => set('title', v)} placeholder="Sunday Casual Run" maxLength={120} />
        <Text style={s.label}>Description</Text>
        <TextInput style={[s.input, { height: 90, textAlignVertical: 'top' }]} multiline value={form.description} onChangeText={v => set('description', v)} />
        <Text style={s.label}>Category</Text>
        <View style={s.row}>
          {CATEGORIES.map(c => <Pill key={c.key} label={c.label} active={form.category === c.key} onPress={() => set('category', c.key)} />)}
        </View>
        <Text style={s.label}>Distance (km)</Text>
        <TextInput style={s.input} keyboardType="decimal-pad" value={form.distance} onChangeText={v => set('distance', v)} />
        <Text style={s.label}>Difficulty</Text>
        <View style={s.row}>
          {DIFFICULTIES.map(d => <Pill key={d} label={d} active={form.difficulty === d} onPress={() => set('difficulty', d)} />)}
        </View>

        <Text style={s.section}>Location</Text>
        <Text style={s.label}>City</Text>
        <TextInput style={s.input} value={form.city} onChangeText={v => set('city', v)} placeholder="Kolkata" />
        <Text style={s.label}>Meeting point</Text>
        <TextInput style={s.input} value={form.meetingPoint} onChangeText={v => set('meetingPoint', v)} placeholder="Main gate, Lake Area" />

        <Text style={s.section}>Schedule</Text>
        <DateTimeField label="Start" value={form.starts} minimumDate={new Date()} onChange={pickStart} />
        <DateTimeField label="Registration closes" value={form.regCloses} minimumDate={new Date()} onChange={pickRegCloses} />
        <DateTimeField label="End" value={form.ends} minimumDate={new Date(form.starts.getTime() + 60000)} onChange={pickEnds} />

        <Text style={s.section}>Capacity</Text>
        <Text style={s.label}>Maximum runners</Text>
        <TextInput style={s.input} keyboardType="number-pad" value={form.capacity} onChangeText={v => set('capacity', v)} />
        <View style={s.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Enable waitlist</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
              When the event is full, extra runners join a queue. If someone cancels, the first person on the waitlist is confirmed automatically and notified.
            </Text>
          </View>
          <Switch value={form.waitlist} onValueChange={v => set('waitlist', v)} />
        </View>

        <Text style={s.section}>Paid event</Text>
        <View style={s.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>This is a paid event</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
              Runners apply, you approve them, then they pay the entry fee and confirm. Leave off for free events.
            </Text>
          </View>
          <Switch value={isPaid} onValueChange={setIsPaid} />
        </View>
        {isPaid && (
          <>
            <Text style={s.label}>Entry fee (₹)</Text>
            <TextInput style={s.input} keyboardType="decimal-pad" value={fee} onChangeText={setFee} placeholder="e.g. 300" />
            <Text style={s.label}>Number of winners (0–10)</Text>
            <TextInput style={s.input} keyboardType="number-pad" value={winnersText} onChangeText={setWinners} />
            {prizes.map((p, i) => (
              <View key={i} style={s.prizeCard}>
                <Text style={s.prizeTitle}>{ordinal(i + 1)} prize</Text>
                <View style={s.row}>
                  <Pill label="Cash" active={p.type === 'cash'} onPress={() => updatePrize(i, { type: 'cash' })} />
                  <Pill label="Other" active={p.type === 'other'} onPress={() => updatePrize(i, { type: 'other' })} />
                </View>
                {p.type === 'cash' ? (
                  <TextInput style={[s.input, { marginTop: 10 }]} keyboardType="number-pad" value={p.amount}
                    onChangeText={v => updatePrize(i, { amount: v.replace(/[^0-9.]/g, '') })} placeholder="Amount (₹)" />
                ) : (
                  <TextInput style={[s.input, { marginTop: 10 }]} value={p.label}
                    onChangeText={v => updatePrize(i, { label: v })} placeholder="e.g. Trophy, medal, voucher" maxLength={80} />
                )}
              </View>
            ))}
          </>
        )}

        <Text style={s.section}>Home screen</Text>
        <View style={s.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Feature on Home</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>Featured events appear in their own section at the top of Home.</Text>
          </View>
          <Switch value={featured} onValueChange={setFeatured} />
        </View>

        <Text style={s.section}>Details</Text>
        <Text style={s.label}>Facilities (comma separated)</Text>
        <TextInput style={s.input} value={form.facilities} onChangeText={v => set('facilities', v)} placeholder="Water stations, Restrooms" />

        <View style={{ marginTop: 24, gap: 10 }}>
          {status !== 'published' ? (
            <>
              <PrimaryButton title="Publish event" onPress={() => save('published')} loading={busy} />
              <PrimaryButton title="Save as draft" variant="outline" onPress={() => save('draft')} disabled={busy} />
            </>
          ) : (
            <>
              <PrimaryButton title="Save changes" onPress={() => save('published')} loading={busy} />
              <PrimaryButton title="Unpublish" variant="outline" onPress={() => save('unpublished')} disabled={busy} />
              <PrimaryButton title="Cancel event" variant="outline" onPress={cancelEvent} disabled={busy} />
            </>
          )}
        </View>
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
  section: { fontSize: 16, fontWeight: '800', color: colors.forest, marginTop: 24 },
  label: { fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderRadius: radius.btn, borderWidth: 1, borderColor: colors.border, padding: 14, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  pillOn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  pillTxt: { color: colors.text, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.btn, padding: 14, marginTop: 14 },
  cover: { height: 180, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginTop: 10 },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  link: { color: colors.emeraldDeep, fontWeight: '700' },
  prizeCard: { backgroundColor: '#fff', borderRadius: radius.btn, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.border },
  prizeTitle: { fontSize: 14, fontWeight: '800', color: colors.forest },
});
