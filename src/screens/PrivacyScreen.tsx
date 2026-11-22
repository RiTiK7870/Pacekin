import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Notice, PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import { getPrivacy, savePrivacy, listBlocked, unblockRunner } from '../services/friends';
import { colors, radius } from '../lib/config';

export default function PrivacyScreen() {
  const [p, setP] = useState<any>(null);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [privacy, blk] = await Promise.all([getPrivacy(), listBlocked()]);
      setP(privacy);
      setBlocked(blk);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = async (patch: Record<string, unknown>) => {
    setP((cur: any) => ({ ...cur, ...patch }));
    try {
      await savePrivacy(patch);
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
      load();
    }
  };

  const unblock = async (id: string) => {
    try {
      await unblockRunner(id);
      await load();
    } catch (e: any) {
      Alert.alert('Could not unblock', e.message);
    }
  };

  if (!loaded) return <Notice text="Loading settings…" />;
  if (error) return <Notice text={error} onRetry={load} />;
  if (!p) return <Notice text="Your privacy settings could not be loaded." onRetry={load} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={s.section}>Visibility</Text>
        <Toggle label="Show me in runner search" value={p.discoverable} onChange={v => update({ discoverable: v })} />
        <Toggle label="Show my city on my profile" value={p.show_city} onChange={v => update({ show_city: v })} />

        <Text style={s.section}>Friend requests</Text>
        <Text style={s.copy}>Who can send you a friend request?</Text>
        <View style={s.row}>
          <Pill label="Everyone" active={p.friend_requests_from === 'everyone'} onPress={() => update({ friend_requests_from: 'everyone' })} />
          <Pill label="No one" active={p.friend_requests_from === 'nobody'} onPress={() => update({ friend_requests_from: 'nobody' })} />
        </View>

        <Text style={s.section}>Blocked runners</Text>
        {blocked.length === 0 && <Text style={s.copy}>You have not blocked anyone.</Text>}
        {blocked.map(b => (
          <View key={b.id} style={s.card}>
            <Text style={s.name}>{b.card?.full_name ?? b.card?.username ?? 'Blocked runner'}</Text>
            <PrimaryButton title="Unblock" variant="outline" onPress={() => unblock(b.id)} style={{ height: 40, paddingHorizontal: 16 }} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggle}>
      <Text style={s.toggleTxt}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
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
  section: { fontSize: 16, fontWeight: '800', color: colors.forest, marginTop: 20, marginBottom: 10 },
  copy: { color: colors.muted, marginBottom: 10, lineHeight: 20 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 10 },
  toggleTxt: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600', paddingRight: 12 },
  row: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  pillOn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  pillTxt: { color: colors.text, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
});
