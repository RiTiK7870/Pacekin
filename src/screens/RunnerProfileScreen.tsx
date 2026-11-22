import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { Notice, PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import {
  getCard, getRelation, sendFriendRequest, respondRequest, removeFriend, openDirectChat,
  blockRunner, unblockRunner, Card, Relation,
} from '../services/friends';
import { colors, radius } from '../lib/config';

export default function RunnerProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const [card, setCard] = useState<Card | null>(null);
  const [rel, setRel] = useState<Relation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [c, r] = await Promise.all([getCard(userId), getRelation(userId)]);
      setCard(c);
      setRel(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <Notice text={error} onRetry={load} />;
  if (!loaded) return <Notice text="Loading profile…" />;

  const status = rel?.status ?? 'none';
  if (!card && status !== 'blocked') {
    return <Notice text="This runner's profile is not available." />;
  }

  const run = async (action: () => Promise<any>, done?: string) => {
    setBusy(true);
    try {
      await action();
      if (done) Alert.alert(done);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update', e.message);
    } finally {
      setBusy(false);
    }
  };

  const message = async () => {
    setBusy(true);
    try {
      const cid = await openDirectChat(userId);
      navigation.navigate('DirectChat', { conversationId: cid, name: card?.full_name ?? card?.username ?? 'Chat' });
    } catch (e: any) {
      Alert.alert('Cannot message yet', e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeConfirm = () => Alert.alert('Remove friend?', 'You can add each other again later.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => run(() => removeFriend(userId), 'Friend removed') },
  ]);

  const blockConfirm = () => Alert.alert(
    'Block this runner?',
    'They will not be able to message you or send friend requests, and any friendship will end.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => run(() => blockRunner(userId), 'Runner blocked') },
    ]);

  const name = card?.full_name ?? card?.username ?? 'Runner';
  const initial = name.charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.header}>
          <View style={s.avatar}>
            {card?.avatar_url
              ? <Image source={{ uri: card.avatar_url }} style={{ width: 96, height: 96, borderRadius: 48 }} contentFit="cover" />
              : <Text style={s.avatarTxt}>{initial}</Text>}
          </View>
          <Text style={s.name}>{name}</Text>
          {!!card?.username && <Text style={s.handle}>@{card.username}</Text>}
          <Text style={s.sub}>{[card?.city, card?.experience_level].filter(Boolean).join(' · ') || ' '}</Text>
        </View>

        <View style={s.body}>
          {status === 'blocked' && (
            <Text style={s.note}>You have blocked this runner. They can't message you or send requests.</Text>
          )}
          {!!card?.bio && <><Text style={s.label}>About</Text><Text style={s.copy}>{card.bio}</Text></>}
          {!!card?.preferred_distance && <><Text style={s.label}>Prefers</Text><Text style={s.copy}>{card.preferred_distance}</Text></>}
          {!!card?.running_goal && <><Text style={s.label}>Goal</Text><Text style={s.copy}>{card.running_goal}</Text></>}

          <View style={{ marginTop: 26, gap: 10 }}>
            {status === 'none' && (
              <PrimaryButton title="Add friend" loading={busy}
                onPress={() => run(() => sendFriendRequest(userId), 'Friend request sent')} />
            )}
            {status === 'outgoing' && <PrimaryButton title="Request sent" variant="outline" disabled onPress={() => {}} />}
            {status === 'incoming' && (
              <>
                <PrimaryButton title="Accept request" loading={busy}
                  onPress={() => run(() => respondRequest(rel!.requestId!, true), 'You are now friends')} />
                <PrimaryButton title="Decline" variant="outline"
                  onPress={() => run(() => respondRequest(rel!.requestId!, false))} />
              </>
            )}
            {status === 'friends' && (
              <>
                <PrimaryButton title="Message" loading={busy} onPress={message} />
                <PrimaryButton title="Remove friend" variant="outline" onPress={removeConfirm} />
              </>
            )}
            {status === 'blocked' && (
              <PrimaryButton title="Unblock" variant="outline" loading={busy}
                onPress={() => run(() => unblockRunner(userId), 'Runner unblocked')} />
            )}
          </View>

          {status !== 'blocked' && (
            <View style={{ marginTop: 22, gap: 10 }}>
              <PrimaryButton title="Report runner" variant="outline"
                onPress={() => navigation.navigate('ReportRunner', { userId, name })} />
              <PrimaryButton title="Block runner" variant="outline" onPress={blockConfirm} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, alignItems: 'center', paddingTop: 28, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarTxt: { color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 12 },
  handle: { color: colors.mint, marginTop: 2 },
  sub: { color: colors.mint, marginTop: 4, fontSize: 13 },
  body: { padding: 20 },
  note: { backgroundColor: '#FEF3C7', color: '#92400E', padding: 12, borderRadius: radius.btn, marginBottom: 14, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted, marginTop: 14, marginBottom: 4, textTransform: 'uppercase' },
  copy: { fontSize: 15, color: colors.text, lineHeight: 21 },
});
