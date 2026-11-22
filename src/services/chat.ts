import { supabase } from '../lib/supabase';
import { profilesFor } from './groups';

// Photos are stored as a message whose text is "photo::<public url>".
export const PHOTO_PREFIX = 'photo::';
export const isPhoto = (body?: string | null) => !!body && body.startsWith(PHOTO_PREFIX);
export const photoUrl = (body: string) => body.slice(PHOTO_PREFIX.length);
export const REACTIONS = ['👍', '❤️', '😂', '🔥'];

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

export async function listThread(conversationId: string) {
  const me = await currentUserId();
  const { data: rows, error } = await supabase.from('messages')
    .select('id, body, created_at, edited_at, deleted_at, sender_id, reply_to_id, pinned_at')
    .eq('conversation_id', conversationId)
    .eq('moderation_status', 'visible')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  const msgs = rows ?? [];
  const ids = msgs.map((m: any) => m.id);

  const [rx, mutes] = await Promise.all([
    ids.length
      ? supabase.from('message_reactions').select('message_id, user_id, emoji').in('message_id', ids)
      : Promise.resolve({ data: [], error: null } as any),
    supabase.from('user_mutes').select('muted_id').eq('muter_id', me),
  ]);
  if (rx.error) throw rx.error;
  if (mutes.error) throw mutes.error;

  const mutedIds: string[] = (mutes.data ?? []).map((m: any) => m.muted_id);
  const profiles = await profilesFor(msgs.map((m: any) => m.sender_id));

  const reactions: Record<string, Record<string, { count: number; mine: boolean }>> = {};
  for (const r of rx.data ?? []) {
    const byEmoji = (reactions[r.message_id] ??= {});
    const cur = (byEmoji[r.emoji] ??= { count: 0, mine: false });
    cur.count += 1;
    if (r.user_id === me) cur.mine = true;
  }

  const messages = msgs
    .filter((m: any) => !mutedIds.includes(m.sender_id))
    .map((m: any) => ({ ...m, profiles: profiles.get(m.sender_id) ?? null }));
  return { messages, reactions, mutedIds };
}

export async function getPinned(conversationId: string) {
  const { data, error } = await supabase.from('messages')
    .select('id, body, sender_id')
    .eq('conversation_id', conversationId)
    .not('pinned_at', 'is', null)
    .eq('moderation_status', 'visible')
    .order('pinned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function sendText(conversationId: string, body: string, replyTo: string | null = null) {
  const me = await currentUserId();
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId, sender_id: me, body, reply_to_id: replyTo,
  });
  if (error) throw error;
}

export async function sendPhoto(conversationId: string, localUri: string, replyTo: string | null = null) {
  const me = await currentUserId();
  const bytes = await (await fetch(localUri)).arrayBuffer();
  const path = `${me}/chat/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType: 'image/jpeg', upsert: false,
  });
  if (upErr) throw upErr;
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  await sendText(conversationId, PHOTO_PREFIX + url, replyTo);
}

export async function editMessage(messageId: string, body: string) {
  const me = await currentUserId();
  const { error } = await supabase.from('messages').update({ body }).eq('id', messageId).eq('sender_id', me);
  if (error) throw error;
}

export async function deleteMessage(messageId: string) {
  const me = await currentUserId();
  const { error } = await supabase.from('messages')
    .update({ deleted_at: new Date().toISOString() }).eq('id', messageId).eq('sender_id', me);
  if (error) throw error;
}

export async function reactToMessage(messageId: string, emoji: string) {
  const me = await currentUserId();
  const { error } = await supabase.from('message_reactions')
    .insert({ message_id: messageId, user_id: me, emoji });
  if (error && error.code !== '23505') throw error;
}

export async function removeReaction(messageId: string, emoji: string) {
  const me = await currentUserId();
  const { error } = await supabase.from('message_reactions').delete()
    .eq('message_id', messageId).eq('user_id', me).eq('emoji', emoji);
  if (error) throw error;
}

// Moderators and admins only (RLS: messages_staff_update).
export async function setPinned(messageId: string, pin: boolean) {
  const me = await currentUserId();
  const { error } = await supabase.from('messages')
    .update({ pinned_at: pin ? new Date().toISOString() : null, pinned_by: pin ? me : null })
    .eq('id', messageId);
  if (error) throw error;
}

export async function searchRoom(conversationId: string, term: string) {
  const t = term.replace(/[%,()]/g, '').trim();
  if (t.length < 2) return [];
  const { data, error } = await supabase.from('messages')
    .select('id, body, created_at, sender_id')
    .eq('conversation_id', conversationId)
    .eq('moderation_status', 'visible')
    .is('deleted_at', null)
    .ilike('body', `%${t}%`)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  const rows = data ?? [];
  const profiles = await profilesFor(rows.map((m: any) => m.sender_id));
  return rows.map((m: any) => ({ ...m, profiles: profiles.get(m.sender_id) ?? null }));
}

export async function getRoomMuted(conversationId: string) {
  const me = await currentUserId();
  const { data, error } = await supabase.from('conversation_members')
    .select('muted_until').eq('conversation_id', conversationId).eq('user_id', me).maybeSingle();
  if (error) throw error;
  return !!data?.muted_until && new Date(data.muted_until) > new Date();
}

export async function setRoomMuted(conversationId: string, muted: boolean) {
  const me = await currentUserId();
  const { error } = await supabase.from('conversation_members')
    .update({ muted_until: muted ? '2100-01-01T00:00:00Z' : null })
    .eq('conversation_id', conversationId).eq('user_id', me);
  if (error) throw error;
}

export async function setRunnerMuted(userId: string, mute: boolean) {
  const me = await currentUserId();
  if (mute) {
    const { error } = await supabase.from('user_mutes').insert({ muter_id: me, muted_id: userId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase.from('user_mutes').delete().eq('muter_id', me).eq('muted_id', userId);
    if (error) throw error;
  }
}

export async function getSlowMode(roomId?: string | null) {
  if (!roomId) return 0;
  const { data, error } = await supabase.from('chat_rooms').select('slow_mode_seconds').eq('id', roomId).maybeSingle();
  if (error) throw error;
  return data?.slow_mode_seconds ?? 0;
}

// Moderators and admins only (RLS: rooms_staff_write).
export async function setSlowMode(roomId: string, seconds: number) {
  const { error } = await supabase.from('chat_rooms').update({ slow_mode_seconds: seconds }).eq('id', roomId);
  if (error) throw error;
}
