import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Notice } from '../components/ui';
import { Alert } from '../lib/alert';
import { listChats, listSocial, findRunners, respondRequest, Card } from '../services/friends';
import { colors, radius } from '../lib/config';

type Tab = 'chats' | 'friends' | 'requests' | 'find';
const TABS: [Tab, string][] = [['chats', 'Chats'], ['friends', 'Friends'], ['requests', 'Requests'], ['find', 'Find']];

export default function FriendsScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('chats');
  const [chats, setChats] = useState<any[]>([]);
  const [social, setSocial] = useState<any>({ friends: [], incoming: [], outgoing: [] });
  const [term, setTerm] = useState('');
  const [found, setFound] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [c, s] = await Promise.all([listChats(), listSocial()]);
      setChats(c);
      setSocial(s);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) { setFound([]); return; }
    const h = setTimeout(async () => {
      try { setFound(await findRunners(t)); }
      catch (e: any) { Alert.alert('Search failed', e.message); }
    }, 350);
    return () => clearTimeout(h);
  }, [term]);

  const respond = async (requestId: string, accept: boolean) => {
    try {
      await respondRequest(requestId, accept);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update request', e.message);
    }
  };

  const openProfile = (id: string) => navigation.navigate('RunnerProfile', { userId: id });
  const nameOf = (card: Card | null) => card?.full_name ?? card?.username ?? 'Runner';

  const Row = ({ card, onPress, right, sub }: { card: Card | null; onPress?: () => void; right?: React.ReactNode; sub?: string }) => (
    <Pressable onPress={onPress} style={s.row}>
      <View style={s.avatar}>
        {card?.avatar_url
          ? <Image source={{ uri: card.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
          : <Text style={s.avatarTxt}>{nameOf(card).charAt(0).toUpperCase()}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{nameOf(card)}</Text>
        <Text style={s.meta} numberOfLines={1}>{sub ?? [card?.username && `@${card.username}`, card?.city].filter(Boolean).join(' · ')}</Text>
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );

  const empty = (text: string) => <Text style={s.empty}>{text}</Text>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Friends & messages</Text>
        <View style={s.tabs}>
          {TABS.map(([key, label]) => {
            const count = key === 'requests' ? social.incoming.length : 0;
            return (
              <Pressable key={key} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabOn]}>
                <Text style={[s.tabTxt, tab === key && { color: colors.forest }]}>
                  {label}{count > 0 ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Notice text={error} onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {tab === 'chats' && (chats.length === 0
            ? empty('No conversations yet. Message a friend from their profile.')
            : chats.map(c => c.otherId && (
                <Row key={c.conversationId} card={c.card}
                  onPress={() => navigation.navigate('DirectChat', { conversationId: c.conversationId, name: nameOf(c.card) })} />
              )))}

          {tab === 'friends' && (social.friends.length === 0
            ? empty('You have no friends yet. Find runners in the Find tab.')
            : social.friends.map((f: any) => <Row key={f.id} card={f.card} onPress={() => openProfile(f.id)} />))}

          {tab === 'requests' && (
            <>
              <Text style={s.section}>Incoming</Text>
              {social.incoming.length === 0 && empty('No incoming requests.')}
              {social.incoming.map((r: any) => (
                <Row key={r.requestId} card={r.card} onPress={() => openProfile(r.id)} sub={r.intro || undefined}
                  right={
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable onPress={() => respond(r.requestId, true)} style={[s.btn, s.btnOk]}><Text style={[s.btnTxt, { color: '#fff' }]}>Accept</Text></Pressable>
                      <Pressable onPress={() => respond(r.requestId, false)} style={s.btn}><Text style={s.btnTxt}>Decline</Text></Pressable>
                    </View>
                  } />
              ))}
              <Text style={s.section}>Sent</Text>
              {social.outgoing.length === 0 && empty('No pending requests you sent.')}
              {social.outgoing.map((r: any) => (
                <Row key={r.requestId} card={r.card} onPress={() => openProfile(r.id)}
                  right={<Text style={s.pending}>Pending</Text>} />
              ))}
            </>
          )}

          {tab === 'find' && (
            <>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color={colors.muted} />
                <TextInput style={s.searchInput} value={term} onChangeText={setTerm}
                  placeholder="Search by name or username" placeholderTextColor={colors.muted} autoCapitalize="none" />
              </View>
              {term.trim().length < 2
                ? empty('Type at least 2 letters to search.')
                : found.length === 0 ? empty('No runners found.')
                : found.map(c => <Row key={c.id} card={c} onPress={() => openProfile(c.id)} />)}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center' },
  tabOn: { backgroundColor: '#fff', borderColor: '#fff' },
  tabTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  section: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 6, marginBottom: 8 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginBottom: 10, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  btnOk: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  btnTxt: { fontWeight: '700', fontSize: 12, color: colors.text },
  pending: { fontSize: 12, fontWeight: '700', color: colors.muted },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, height: 46, gap: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
});
