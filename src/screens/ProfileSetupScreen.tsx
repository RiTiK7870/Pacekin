import { Alert } from '../lib/alert';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, MIN_AGE, radius } from '../lib/config';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const DISTANCES = ['1–3 km', '5 km', '10 km', 'Half marathon', 'Full marathon', 'Other'];

// Stored as YYYY-MM-DD in local time (what the database expects).
const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toDisplay = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ProfileSetupScreen() {
  const { session, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [level, setLevel] = useState('Beginner');
  const [dist, setDist] = useState('5 km');
  const [busy, setBusy] = useState(false);

  const onDobChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selected) setDob(selected);
    } else if (selected) {
      setDob(selected);
    }
  };

  const save = async () => {
    if (!name.trim() || !city.trim()) return Alert.alert('Missing details', 'Name and city are required.');
    if (!dob) return Alert.alert('Date of birth', 'Please select your date of birth.');
    if ((Date.now() - dob.getTime()) / (365.25 * 864e5) < MIN_AGE) {
      return Alert.alert('Not eligible', `You must be at least ${MIN_AGE} years old.`);
    }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      full_name: name.trim(),
      city: city.trim(),
      date_of_birth: toIsoDate(dob),
      experience_level: level,
      preferred_distance: dist,
    }).eq('id', session!.user.id);
    setBusy(false);
    if (error) return Alert.alert('Could not save', error.message);
    await refreshProfile();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={s.h1}>Set up your profile</Text>

        <Text style={s.label}>Full name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your name" />

        <Text style={s.label}>City</Text>
        <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="e.g. Kolkata" />

        <Text style={s.label}>Date of birth</Text>
        <Pressable style={[s.input, s.dobBox]} onPress={() => setShowPicker(true)} accessibilityRole="button">
          <Text style={{ flex: 1, fontSize: 16, color: dob ? colors.text : colors.muted }}>
            {dob ? toDisplay(dob) : 'Select your date of birth'}
          </Text>
          <Ionicons name="calendar-outline" size={20} color={colors.forest} />
        </Pressable>
        {showPicker && (
          <View>
            <DateTimePicker
              value={dob ?? new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              minimumDate={new Date(1920, 0, 1)}
              onChange={onDobChange}
            />
            {Platform.OS === 'ios' && (
              <PrimaryButton title="Done" variant="outline" onPress={() => setShowPicker(false)} style={{ marginTop: 8 }} />
            )}
          </View>
        )}

        <Text style={s.label}>Experience</Text>
        <View style={s.row}>
          {LEVELS.map(l => <Chip key={l} label={l} active={level === l} onPress={() => setLevel(l)} />)}
        </View>

        <Text style={s.label}>Preferred distance</Text>
        <View style={s.row}>
          {DISTANCES.map(d => <Chip key={d} label={d} active={dist === d} onPress={() => setDist(d)} />)}
        </View>

        <PrimaryButton title="Continue" onPress={save} loading={busy} style={{ marginTop: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: colors.emerald, borderColor: colors.emerald }]}>
      <Text style={[{ color: colors.text, fontWeight: '600' }, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '700', color: colors.forest, marginBottom: 16 },
  label: { fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderRadius: radius.btn, borderWidth: 1, borderColor: colors.border, padding: 14, fontSize: 16 },
  dobBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
});
