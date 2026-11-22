import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Notice } from '../components/ui';
import { listCommunityRooms } from '../services/community';
import { colors, radius } from '../lib/config';

const RULES = [
  'Be respectful. No harassment, bullying, threats or hate.',
  'No spam, scams or repeated links.',
  'Never share someone else\'s private information or location.',
  'Don\'t pretend to be a Pacekin administrator or post fake events.',
  'Share training tips as personal experience, not guaranteed medical advice.',
];

const TYPE_LABEL: Record<string, string> = {
  system: 'Community', general: 'General', beginner: 'Beginners', distance: 'Distance',
  local: 'Local', challenge: 'Challenges',
};

export default function CommunityRoomsScreen({ navigation }: any) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setError(null); setRooms(await listCommunityRooms()); }
    catch (e: any) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (r: any) => navigation.navigate('GroupChat', {
    roomId: r.id, conversationId: r.conversation_id, name: r.name, joinMode: 'public',
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Community rooms</Text>
        <Text style={s.sub}>Public discussion for every kind of runner</Text>
      </View>

      {error ? <Notice text={error} onRetry={load} /> : (
        <FlatList
          data={rooms}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={s.rules}>
              <View style={s.rulesHead}>
                <Ionicons name="shield-checkmark" size={18} color={colors.emeraldDeep} />
                <Text style={s.rulesTitle}>Community guidelines</Text>
              </View>
              {RULES.map(r => <Text key={r} style={s.rule}>• {r}</Text>)}
              <Text style={s.rulesFoot}>
                Long-press any message from someone else to report it. Moderators review every report.
              </Text>
            </View>
          }
          ListEmptyComponent={<Notice text="No community rooms are open yet." />}
          renderItem={({ item: r }) => (
            <Pressable onPress={() => open(r)} style={s.card}>
              <View style={s.icon}><Ionicons name="chatbubbles" size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{r.name}</Text>
                {!!r.description && <Text style={s.desc}>{r.description}</Text>}
                <Text style={s.tag}>{TYPE_LABEL[r.room_type] ?? 'Community'}{r.joined ? ' · Joined' : ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  sub: { color: colors.mint, fontSize: 13, marginTop: 4 },
  rules: { backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 16 },
  rulesHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rulesTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  rule: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 4 },
  rulesFoot: { fontSize: 12, color: colors.emeraldDeep, marginTop: 8, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginBottom: 10, gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  desc: { fontSize: 12, color: colors.muted, marginTop: 3, lineHeight: 16 },
  tag: { fontSize: 11, color: colors.emeraldDeep, fontWeight: '700', marginTop: 5 },
});
