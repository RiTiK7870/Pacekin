import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import { createGroup, GROUP_DISTANCES, GROUP_LEVELS } from '../services/groups';
import { colors, radius } from '../lib/config';

export default function CreateGroupScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const [distances, setDistances] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [busy, setBusy] = useState(false);

  const toggleDistance = (d: string) =>
    setDistances(list => (list.includes(d) ? list.filter(x => x !== d) : [...list, d]));

  const save = async () => {
    if (name.trim().length < 3) return Alert.alert('Name', 'Group name must be at least 3 characters.');
    if (!city.trim()) return Alert.alert('City', 'Please enter the city this group runs in.');
    setBusy(true);
    try {
      const id = await createGroup({
        name: name.trim(),
        description: description.trim() || null,
        city: city.trim(),
        running_level: level,
        preferred_distances: distances,
        visibility,
      });
      navigation.replace('GroupDetail', { groupId: id });
    } catch (e: any) {
      Alert.alert('Could not create group', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={s.label}>Group name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Kolkata Dawn Runners" maxLength={60} />
        <Text style={s.label}>Description</Text>
        <TextInput style={[s.input, { height: 90, textAlignVertical: 'top' }]} multiline value={description} onChangeText={setDescription} maxLength={1000} placeholder="Who the group is for, meeting days, pace" />
        <Text style={s.label}>City</Text>
        <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="Kolkata" maxLength={60} />

        <Text style={s.label}>Running level (optional)</Text>
        <View style={s.row}>
          {GROUP_LEVELS.map(l => <Pill key={l} label={l} active={level === l} onPress={() => setLevel(level === l ? null : l)} />)}
        </View>

        <Text style={s.label}>Preferred distances</Text>
        <View style={s.row}>
          {GROUP_DISTANCES.map(d => <Pill key={d} label={d} active={distances.includes(d)} onPress={() => toggleDistance(d)} />)}
        </View>

        <Text style={s.label}>Who can join</Text>
        <View style={s.row}>
          <Pill label="Public: anyone can join" active={visibility === 'public'} onPress={() => setVisibility('public')} />
          <Pill label="Private: approval needed" active={visibility === 'private'} onPress={() => setVisibility('private')} />
        </View>
        <Text style={s.hint}>
          Private groups are hidden from discovery. Members find them through the group owner.
        </Text>

        <PrimaryButton title="Create group" onPress={save} loading={busy} style={{ marginTop: 24 }} />
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
  label: { fontSize: 13, color: colors.muted, marginTop: 16, marginBottom: 6, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 17 },
  input: { backgroundColor: '#fff', borderRadius: radius.btn, borderWidth: 1, borderColor: colors.border, padding: 14, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  pillOn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  pillTxt: { color: colors.text, fontWeight: '600' },
});
