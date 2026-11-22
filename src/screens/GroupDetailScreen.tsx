import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Notice, PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import {
  getGroupDetail, joinGroup, leaveGroup, reviewJoinRequest, removeMember,
  setMemberRole, createGroupRoom,
} from '../services/groups';
import { ageOf } from '../services/adminEvents';
import { colors, radius } from '../lib/config';

export default function GroupDetailScreen({ route, navigation }: any) {
  const { groupId } = route.params;
  const { session } = useAuth();
  const uid = session?.user.id;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await getGroupDetail(groupId));
    } catch (e: any) {
      setError(e.message);
    }
  }, [groupId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <Notice text={error} onRetry={load} />;
  if (!data) return <Notice text="Loading group…" />;

  const { group, members, rooms, requests, myRole, myRequestPending } = data;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isMember = !!myRole;

  const run = async (action: () => Promise<void>, onDone?: string) => {
    setBusy(true);
    try {
      await action();
      if (onDone) Alert.alert(onDone);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update', e.message);
    } finally {
      setBusy(false);
    }
  };

  const join = () => run(async () => {
    const result = await joinGroup(groupId);
    Alert.alert(result === 'requested' ? 'Request sent' : 'Welcome to the group!',
      result === 'requested' ? 'The group admins will review your request.' : undefined);
  });

  const leave = () => Alert.alert('Leave group?', `You will leave ${group.name}.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: () => run(() => leaveGroup(groupId)) },
  ]);

  const kick = (m: any) => Alert.alert('Remove member?', `Remove ${m.full_name ?? 'this runner'} from the group?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => run(() => removeMember(groupId, m.user_id)) },
  ]);

  const toggleAdmin = (m: any) => run(() => setMemberRole(groupId, m.user_id, m.role === 'admin' ? 'member' : 'admin'));

  const decide = (r: any, approve: boolean) => run(() => reviewJoinRequest(r.id, approve));

  const newChat = () => run(async () => {
    await createGroupRoom(groupId, `${group.name} chat`, 'Group discussion');
  }, 'Group chat created');

  const openRoom = (r: any) => navigation.navigate('GroupChat', {
    roomId: r.id, conversationId: r.conversation_id, name: r.name,
  });

  let joinLabel = group.visibility === 'private' ? 'Request to join' : 'Join group';
  if (myRequestPending) joinLabel = 'Request pending';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        <View style={s.header}>
          <View style={s.badgeRow}>
            <Text style={s.badge}>{group.visibility === 'private' ? 'PRIVATE' : 'PUBLIC'}</Text>
            {!!group.running_level && <Text style={s.badge}>{group.running_level.toUpperCase()}</Text>}
          </View>
          <Text style={s.title}>{group.name}</Text>
          <Text style={s.sub}>{[group.city, `${members.length} member${members.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</Text>
        </View>

        <View style={s.body}>
          {!!group.description && <Text style={s.copy}>{group.description}</Text>}
          {(group.preferred_distances ?? []).length > 0 && (
            <Text style={s.copy}>Distances: {group.preferred_distances.join(', ')}</Text>
          )}

          {isAdmin && (
            <>
              <Text style={s.section}>Join requests ({requests.length})</Text>
              {requests.length === 0 ? <Text style={s.copy}>No pending requests.</Text> : requests.map((r: any) => (
                <View key={r.id} style={s.card}>
                  <Text style={s.name}>{r.full_name ?? 'Runner'}{r.username ? `  @${r.username}` : ''}</Text>
                  <Text style={s.meta}>{ageOf(r.date_of_birth) ?? '—'} yrs · {r.city ?? '—'} · {r.experience_level ?? '—'}</Text>
                  {!!r.message && <Text style={[s.meta, { fontStyle: 'italic' }]}>"{r.message}"</Text>}
                  <View style={s.actions}>
                    <Pressable onPress={() => decide(r, true)} style={[s.actBtn, s.actOk]}><Text style={[s.actTxt, { color: '#fff' }]}>Approve</Text></Pressable>
                    <Pressable onPress={() => decide(r, false)} style={s.actBtn}><Text style={[s.actTxt, { color: colors.danger }]}>Reject</Text></Pressable>
                  </View>
                </View>
              ))}
            </>
          )}

          {isAdmin && (
            <PrimaryButton title="Edit group details" variant="outline" onPress={() => navigation.navigate('EditGroup', { groupId })} style={{ marginTop: 12 }} />
          )}

          <Text style={s.section}>Group chat</Text>
          {isMember && rooms.length === 0 && isAdmin && (
            <PrimaryButton title="Create group chat" variant="outline" onPress={newChat} disabled={busy} />
          )}
          {rooms.length === 0 && !isAdmin && <Text style={s.copy}>No group chat yet.</Text>}
          {rooms.map((r: any) => (
            <Pressable key={r.id} onPress={() => isMember && openRoom(r)} style={s.card}>
              <Ionicons name="chatbubbles-outline" size={20} color={colors.emeraldDeep} />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{r.name}</Text>
                <Text style={s.meta}>{isMember ? 'Tap to open' : 'Members only'}</Text>
              </View>
              {isMember && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
            </Pressable>
          ))}

          <Text style={s.section}>Members</Text>
          {members.map((m: any) => {
            const roleLabel = m.role === 'owner' ? 'Owner' : m.role === 'admin' ? 'Admin' : 'Member';
            const canManage = isAdmin && m.user_id !== uid && m.role !== 'owner' && (isOwner || m.role === 'member');
            return (
              <View key={m.user_id} style={s.card}>
                <View style={s.avatar}>
                  {m.avatar_url
                    ? <Image source={{ uri: m.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
                    : <Text style={s.avatarTxt}>{(m.full_name ?? '?').charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{m.full_name ?? 'Runner'}{m.user_id === uid ? '  (you)' : ''}</Text>
                  <Text style={s.meta}>{roleLabel}{m.experience_level ? ` · ${m.experience_level}` : ''}</Text>
                </View>
                {canManage && (
                  <View style={{ gap: 6 }}>
                    {isOwner && (
                      <Pressable onPress={() => toggleAdmin(m)} style={s.smallBtn}>
                        <Text style={s.smallTxt}>{m.role === 'admin' ? 'Remove admin' : 'Make admin'}</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => kick(m)} style={s.smallBtn}>
                      <Text style={[s.smallTxt, { color: colors.danger }]}>Remove</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.bottom}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.price}>{group.name}</Text>
          <Text style={s.meta} numberOfLines={1}>{isMember ? (isOwner ? 'You own this group' : `You are ${isAdmin ? 'an admin' : 'a member'}`) : 'Not a member'}</Text>
        </View>
        {isMember ? (
          isOwner ? (
            <PrimaryButton title="Owner" variant="outline" disabled onPress={() => {}} style={{ flex: 1, marginLeft: 16 }} />
          ) : (
            <PrimaryButton title="Leave group" variant="outline" onPress={leave} loading={busy} style={{ flex: 1, marginLeft: 16 }} />
          )
        ) : (
          <PrimaryButton title={joinLabel} onPress={join} loading={busy} disabled={myRequestPending} style={{ flex: 1, marginLeft: 16 }} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  badge: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  sub: { color: colors.mint, fontSize: 13, marginTop: 4 },
  body: { padding: 20 },
  copy: { color: colors.muted, lineHeight: 20, marginBottom: 6 },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 22, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginBottom: 10, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarTxt: { color: '#fff', fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10, width: '100%' },
  actBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.emerald, alignItems: 'center' },
  actOk: { backgroundColor: colors.emerald },
  actTxt: { fontWeight: '700', fontSize: 13, color: colors.emeraldDeep },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  smallTxt: { fontSize: 11, fontWeight: '700', color: colors.text },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 32, backgroundColor: '#fff', borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  price: { fontSize: 16, fontWeight: '800', color: colors.text },
});
