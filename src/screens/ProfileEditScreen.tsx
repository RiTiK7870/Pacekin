import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import DateTimeField from '../components/DateTimeField';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import { updateMyProfile, USERNAME_RE } from '../services/profile';
import { colors, MIN_AGE, radius } from '../lib/config';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const DISTANCES = ['1–3 km', '5 km', '10 km', 'Half marathon', 'Full marathon', 'Other'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const TIMES = ['Early morning', 'Morning', 'Afternoon', 'Evening', 'Night'];

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseIsoDate = (iso?: string | null): Date | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return y ? new Date(y, (m ?? 1) - 1, d ?? 1) : null;
};

export default function ProfileEditScreen({ navigation }: any) {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState<string>(profile?.full_name ?? '');
  const [username, setUsername] = useState<string>(profile?.username ?? '');
  const [city, setCity] = useState<string>(profile?.city ?? '');
  const [bio, setBio] = useState<string>(profile?.bio ?? '');
  const [gender, setGender] = useState<string | null>(profile?.gender ?? null);
  const [dob, setDob] = useState<Date>(parseIsoDate(profile?.date_of_birth) ?? new Date(2000, 0, 1));
  const [hasDob, setHasDob] = useState<boolean>(!!profile?.date_of_birth);
  const [level, setLevel] = useState<string>(profile?.experience_level ?? 'Beginner');
  const [distance, setDistance] = useState<string>(profile?.preferred_distance ?? '5 km');
  const [times, setTimes] = useState<string[]>(profile?.preferred_times ?? []);
  const [goal, setGoal] = useState<string>(profile?.running_goal ?? '');
  const [busy, setBusy] = useState(false);

  const toggleTime = (t: string) =>
    setTimes(ts => (ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]));

  const save = async () => {
    const name = fullName.trim();
    const user = username.trim().toLowerCase();
    if (name.length < 2) return Alert.alert('Name', 'Please enter your full name.');
    if (user && !USERNAME_RE.test(user)) {
      return Alert.alert('Username', 'Use 3–20 letters, numbers or underscores.');
    }
    if (!city.trim()) return Alert.alert('City', 'Please enter your city.');
    if (hasDob && (Date.now() - dob.getTime()) / (365.25 * 864e5) < MIN_AGE) {
      return Alert.alert('Not eligible', `You must be at least ${MIN_AGE} years old.`);
    }
    setBusy(true);
    try {
      await updateMyProfile({
        full_name: name,
        username: user || null,
        city: city.trim(),
        bio: bio.trim() || null,
        gender,
        date_of_birth: hasDob ? toIsoDate(dob) : null,
        experience_level: level,
        preferred_distance: distance,
        preferred_times: times,
        running_goal: goal.trim() || null,
      });
      await refreshProfile();
      Alert.alert('Profile saved', 'Your changes are live.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={s.section}>About you</Text>
        <Text style={s.label}>Full name</Text>
        <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Your name" maxLength={60} />
        <Text style={s.label}>Username</Text>
        <TextInput style={s.input} value={username} onChangeText={v => setUsername(v.toLowerCase())} placeholder="e.g. ritik_runs" maxLength={20} autoCapitalize="none" />
        <Text style={s.hint}>3–20 letters, numbers or underscores. Shown to other runners.</Text>
        <Text style={s.label}>City</Text>
        <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="e.g. Kolkata" maxLength={60} />
        <Text style={s.label}>Bio</Text>
        <TextInput style={[s.input, { height: 90, textAlignVertical: 'top' }]} multiline value={bio} onChangeText={setBio} placeholder="A line about your running" maxLength={300} />

        <Text style={s.section}>Personal</Text>
        <Text style={s.label}>Gender</Text>
        <View style={s.row}>
          {GENDERS.map(g => <Pill key={g} label={g} active={gender === g} onPress={() => setGender(g)} />)}
        </View>
        <DateTimeField
          label="Date of birth"
          value={dob}
          dateOnly
          minimumDate={new Date(1920, 0, 1)}
          maximumDate={new Date()}
          onChange={d => { setDob(d); setHasDob(true); }} />

        <Text style={s.section}>Running</Text>
        <Text style={s.label}>Experience</Text>
        <View style={s.row}>
          {LEVELS.map(l => <Pill key={l} label={l} active={level === l} onPress={() => setLevel(l)} />)}
        </View>
        <Text style={s.label}>Preferred distance</Text>
        <View style={s.row}>
          {DISTANCES.map(d => <Pill key={d} label={d} active={distance === d} onPress={() => setDistance(d)} />)}
        </View>
        <Text style={s.label}>Preferred times</Text>
        <View style={s.row}>
          {TIMES.map(t => <Pill key={t} label={t} active={times.includes(t)} onPress={() => toggleTime(t)} />)}
        </View>
        <Text style={s.label}>Running goal</Text>
        <TextInput style={s.input} value={goal} onChangeText={setGoal} placeholder="e.g. Finish my first 10K" maxLength={120} />

        <PrimaryButton title="Save profile" onPress={save} loading={busy} style={{ marginTop: 28 }} />
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
  section: { fontSize: 16, fontWeight: '800', color: colors.forest, marginTop: 20 },
  label: { fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.muted, marginTop: 6 },
  input: { backgroundColor: '#fff', borderRadius: radius.btn, borderWidth: 1, borderColor: colors.border, padding: 14, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  pillOn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  pillTxt: { color: colors.text, fontWeight: '600' },
});
