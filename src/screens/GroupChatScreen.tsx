import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import { joinGroupRoom } from '../services/groups';
import { joinCommunityRoom, reportMessage } from '../services/community';
import { profilesFor } from '../services/groups';
import {
  listThread, getPinned, sendText, sendPhoto, editMessage, deleteMessage, reactToMessage, removeReaction,
  setPinned, searchRoom, getRoomMuted, setRoomMuted, setRunnerMuted, getSlowMode, setSlowMode,
  isPhoto, photoUrl, REACTIONS,
} from '../services/chat';
import { colors, radius } from '../lib/config';

const SLOW_OPTIONS: [number, string][] = [[0, 'Off'], [10, '10 seconds'], [30, '30 seconds'], [60, '1 minute'], [300, '5 minutes']];

export default function GroupChatScreen({ route }: any) {
  const { roomId, conversationId, name, joinMode } = route.params;
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const isStaff = profile?.role === 'admin' || profile?.role === 'moderator';

  const [thread, setThread] = useState<{ messages: any[]; reactions: any; mutedIds: string[] }>({ messages: [], reactions: {}, mutedIds: [] });
  const [pinned, setPinnedMsg] = useState<any>(null);
  const [roomMuted, setRoomMutedState] = useState(false);
  const [slow, setSlow] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  // Height of the on-screen keyboard. The message box moves up by this amount so it stays visible.
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e: any) => setKb(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const load = useCallback(async () => {
    try {
      const [t, p, muted, s] = await Promise.all([
        listThread(conversationId), getPinned(conversationId), getRoomMuted(conversationId), getSlowMode(roomId),
      ]);
      setThread(t);
      setPinnedMsg(p);
      setRoomMutedState(muted);
      setSlow(s);
    } catch (e: any) {
      Alert.alert('Could not load messages', e.message);
    }
  }, [conversationId, roomId]);

  // Join the room when needed, load messages, and refresh on any change in this chat.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (joinMode === 'public' && roomId) await joinCommunityRoom(roomId);
        else if (roomId) await joinGroupRoom(roomId);
        if (active) await load();
      } catch (e: any) {
        if (active) Alert.alert('Chat unavailable', e.message);
      }
    })();
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => { load(); })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, conversationId, joinMode, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (editing) {
        await editMessage(editing.id, body);
        setEditing(null);
      } else {
        await sendText(conversationId, body, replyTo?.id ?? null);
      }
      setText('');
      setReplyTo(null);
      await load();
    } catch (e: any) {
      Alert.alert('Message not sent', e.message);
    } finally {
      setSending(false);
    }
  };

  const attachPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Photos access', 'Allow photo access to share a photo.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (r.canceled || !r.assets[0]) return;
    setSending(true);
    try {
      await sendPhoto(conversationId, r.assets[0].uri, replyTo?.id ?? null);
      setReplyTo(null);
      await load();
    } catch (e: any) {
      Alert.alert('Photo not sent', e.message);
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = async (m: any, emoji: string) => {
    const mine = thread.reactions[m.id]?.[emoji]?.mine;
    try {
      if (mine) await removeReaction(m.id, emoji);
      else await reactToMessage(m.id, emoji);
      await load();
    } catch (e: any) {
      Alert.alert('Could not react', e.message);
    }
  };

  const pickReaction = (m: any) => Alert.alert('React', undefined, [
    ...REACTIONS.map(e => ({ text: e, onPress: () => toggleReaction(m, e) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);

  const confirmDelete = (m: any) => Alert.alert('Delete message?', 'Other people will see that it was deleted.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await deleteMessage(m.id); await load(); }
      catch (e: any) { Alert.alert('Could not delete', e.message); }
    } },
  ]);

  const submitReport = async (messageId: string, reason: string) => {
    try {
      await reportMessage(messageId, reason);
      Alert.alert('Thanks', 'The message has been reported to our moderators.');
    } catch (e: any) {
      Alert.alert('Could not report', e.message);
    }
  };

  const toggleMuteRunner = async (senderId: string, mute: boolean) => {
    try { await setRunnerMuted(senderId, mute); await load(); }
    catch (e: any) { Alert.alert('Could not update', e.message); }
  };

  const onLongPress = (m: any) => {
    if (m.deleted_at) return;
    const own = m.sender_id === uid;
    const photo = isPhoto(m.body);
    const buttons: any[] = [];
    if (own && !photo) buttons.push({ text: 'Edit', onPress: () => { setEditing(m); setReplyTo(null); setText(m.body); } });
    buttons.push({ text: 'Reply', onPress: () => { setReplyTo(m); setEditing(null); } });
    buttons.push({ text: 'React', onPress: () => pickReaction(m) });
    if (own) {
      buttons.push({ text: 'Delete', style: 'destructive', onPress: () => confirmDelete(m) });
    } else {
      buttons.push({ text: 'Report', onPress: () => Alert.alert('Report message', 'Why?', [
        { text: 'Harassment', onPress: () => submitReport(m.id, 'harassment') },
        { text: 'Spam', onPress: () => submitReport(m.id, 'spam') },
        { text: 'Cancel', style: 'cancel' },
      ]) });
      buttons.push({ text: 'Mute runner', onPress: () => toggleMuteRunner(m.sender_id, true) });
    }
    if (isStaff) {
      buttons.push({ text: m.pinned_at ? 'Unpin' : 'Pin', onPress: async () => {
        try { await setPinned(m.id, !m.pinned_at); await load(); }
        catch (e: any) { Alert.alert('Could not pin', e.message); }
      } });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message', undefined, buttons);
  };

  const toggleRoomMute = async () => {
    try { await setRoomMuted(conversationId, !roomMuted); await load(); }
    catch (e: any) { Alert.alert('Could not update', e.message); }
  };

  const manageMuted = async () => {
    if (thread.mutedIds.length === 0) return Alert.alert('Muted runners', 'You have not muted anyone in this chat.');
    const profs = await profilesFor(thread.mutedIds);
    Alert.alert('Muted runners', 'Tap a runner to unmute them.', [
      ...thread.mutedIds.map(id => ({
        text: `Unmute ${profs.get(id)?.full_name ?? 'runner'}`,
        onPress: () => toggleMuteRunner(id, false),
      })),
      { text: 'Close', style: 'cancel' },
    ]);
  };

  const chooseSlow = () => Alert.alert('Slow mode', 'Limit how often each member can send a message.', [
    ...SLOW_OPTIONS.map(([sec, label]) => ({
      text: label,
      onPress: async () => {
        try { await setSlowMode(roomId, sec); await load(); }
        catch (e: any) { Alert.alert('Could not change slow mode', e.message); }
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);

  const runSearch = async () => {
    try { setResults(await searchRoom(conversationId, term)); }
    catch (e: any) { Alert.alert('Search failed', e.message); }
  };

  const parentOf = (m: any) => thread.messages.find(x => x.id === m.reply_to_id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <View style={s.toolbar}>
        <Pressable onPress={() => setSearchOpen(v => !v)} style={s.tool}><Text style={s.toolTxt}>{searchOpen ? 'Close search' : 'Search'}</Text></Pressable>
        <Pressable onPress={toggleRoomMute} style={s.tool}><Text style={s.toolTxt}>{roomMuted ? 'Unmute chat' : 'Mute chat'}</Text></Pressable>
        {thread.mutedIds.length > 0 && (
          <Pressable onPress={manageMuted} style={s.tool}><Text style={s.toolTxt}>Muted ({thread.mutedIds.length})</Text></Pressable>
        )}
        {isStaff && roomId && (
          <Pressable onPress={chooseSlow} style={s.tool}>
            <Text style={s.toolTxt}>Slow mode: {slow ? `${slow}s` : 'off'}</Text>
          </Pressable>
        )}
      </View>

      {!!pinned && (
        <View style={s.pinBar}>
          <Ionicons name="pin" size={14} color={colors.emeraldDeep} />
          <Text style={s.pinTxt} numberOfLines={1}>{isPhoto(pinned.body) ? 'Photo' : pinned.body}</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {searchOpen ? (
          <View style={{ flex: 1 }}>
            <View style={s.searchRow}>
              <TextInput style={s.searchInput} value={term} onChangeText={setTerm} onSubmitEditing={runSearch}
                placeholder="Search this chat" placeholderTextColor={colors.muted} returnKeyType="search" />
              <Pressable onPress={runSearch} style={s.searchBtn}><Text style={s.sendTxt}>Find</Text></Pressable>
            </View>
            <FlatList data={results} keyExtractor={r => r.id} contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={s.empty}>{term.trim().length < 2 ? 'Type at least 2 letters.' : 'No matches.'}</Text>}
              renderItem={({ item: m }) => (
                <View style={s.result}>
                  <Text style={s.who}>{m.profiles?.full_name ?? m.profiles?.username ?? 'Runner'}</Text>
                  <Text style={s.body}>{isPhoto(m.body) ? 'Photo' : m.body}</Text>
                  <Text style={s.time}>{new Date(m.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              )} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
          <FlatList
            data={thread.messages}
            inverted
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item: m }) => {
              const mine = m.sender_id === uid;
              const who = m.profiles?.full_name ?? m.profiles?.username ?? 'Runner';
              const parent = parentOf(m);
              const rx = thread.reactions[m.id] ?? {};
              return (
                <View style={{ maxWidth: '82%', alignSelf: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                  <Pressable onLongPress={() => onLongPress(m)} delayLongPress={450}
                    style={[s.bubble, mine ? s.mine : s.theirs]}>
                    {!mine && <Text style={s.who}>{who}</Text>}
                    {!!m.reply_to_id && (
                      <View style={s.quote}>
                        <Text style={s.quoteTxt} numberOfLines={1}>
                          {parent ? (isPhoto(parent.body) ? 'Photo' : parent.body) : 'Replying to a message'}
                        </Text>
                      </View>
                    )}
                    {m.deleted_at ? (
                      <Text style={[s.body, s.deleted, mine && { color: colors.mint }]}>Message deleted</Text>
                    ) : isPhoto(m.body) ? (
                      <Image source={{ uri: photoUrl(m.body) }} style={s.photo} contentFit="cover" />
                    ) : (
                      <Text style={[s.body, mine && { color: '#fff' }]}>{m.body}</Text>
                    )}
                    <Text style={[s.time, mine && { color: colors.mint }]}>
                      {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {m.edited_at && !m.deleted_at ? ' · edited' : ''}
                      {m.pinned_at ? ' · pinned' : ''}
                    </Text>
                  </Pressable>
                  {Object.keys(rx).length > 0 && (
                    <View style={[s.rxRow, mine && { alignSelf: 'flex-end' }]}>
                      {Object.entries(rx).map(([emoji, info]: any) => (
                        <Pressable key={emoji} onPress={() => toggleReaction(m, emoji)}
                          style={[s.rx, info.mine && s.rxMine]}>
                          <Text style={s.rxTxt}>{emoji} {info.count}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={<Text style={s.empty}>No messages yet. Say hello to the group.</Text>}
          />
          </View>
        )}

        {!searchOpen && (
          <View style={{ paddingBottom: kb }}>
          <>
            {(editing || replyTo) && (
              <View style={s.banner}>
                <Text style={s.bannerTxt} numberOfLines={1}>
                  {editing ? 'Editing your message' : `Replying to ${replyTo.profiles?.full_name ?? 'runner'}`}
                </Text>
                <Pressable onPress={() => { setEditing(null); setReplyTo(null); setText(''); }}>
                  <Ionicons name="close" size={18} color={colors.muted} />
                </Pressable>
              </View>
            )}
            <View style={s.inputRow}>
              {!editing && (
                <Pressable onPress={attachPhoto} style={s.photoBtn} accessibilityLabel="Send a photo">
                  <Ionicons name="image-outline" size={22} color={colors.forest} />
                </Pressable>
              )}
              <TextInput
                style={s.input}
                value={text}
                onChangeText={setText}
                placeholder={`Message ${name}`}
                placeholderTextColor={colors.muted}
                maxLength={2000}
                multiline
              />
              <Pressable style={[s.send, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending}>
                <Text style={s.sendTxt}>{editing ? 'Save' : 'Send'}</Text>
              </Pressable>
            </View>
          </>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.border },
  tool: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  toolTxt: { fontSize: 12, fontWeight: '700', color: colors.forest },
  pinBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.mint },
  pinTxt: { flex: 1, fontSize: 13, color: colors.text },
  bubble: { padding: 12, borderRadius: 16 },
  mine: { backgroundColor: colors.forest },
  theirs: { backgroundColor: '#fff' },
  who: { fontSize: 11, fontWeight: '800', color: colors.emeraldDeep, marginBottom: 4 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.emerald, paddingLeft: 8, marginBottom: 6 },
  quoteTxt: { fontSize: 12, color: colors.muted },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  deleted: { fontStyle: 'italic', color: colors.muted },
  photo: { width: 220, height: 220, borderRadius: 12 },
  time: { fontSize: 10, color: colors.muted, marginTop: 6, alignSelf: 'flex-end' },
  rxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  rx: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  rxMine: { borderColor: colors.emerald, backgroundColor: colors.mint },
  rxTxt: { fontSize: 12, color: colors.text },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  searchRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff' },
  searchInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, height: 44, fontSize: 15, color: colors.text },
  searchBtn: { backgroundColor: colors.forest, borderRadius: radius.pill, paddingHorizontal: 16, justifyContent: 'center' },
  result: { backgroundColor: '#fff', borderRadius: radius.btn, padding: 12, marginBottom: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.bg },
  bannerTxt: { flex: 1, fontSize: 12, color: colors.muted, marginRight: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, backgroundColor: '#fff' },
  photoBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.btn, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 110, fontSize: 15, color: colors.text },
  send: { backgroundColor: colors.forest, borderRadius: radius.pill, paddingHorizontal: 18, height: 46, justifyContent: 'center' },
  sendTxt: { color: '#fff', fontWeight: '700' },
});
