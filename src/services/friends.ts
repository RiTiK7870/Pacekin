import { supabase } from '../lib/supabase';

export type Card = {
  id: string;
  username: string | null;
  full_name: string | null;
  city: string | null;
  avatar_url: string | null;
  experience_level: string | null;
  preferred_distance: string | null;
  bio: string | null;
  running_goal: string | null;
};
export type Relation = {
  status: 'blocked' | 'friends' | 'outgoing' | 'incoming' | 'none';
  requestId: string | null;
};

const CARD_FIELDS = 'id, username, full_name, city, avatar_url, experience_level, preferred_distance, bio, running_goal';

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

// Reads only through public_profiles: it hides minors, non-discoverable and blocked accounts.
async function cardsFor(ids: string[]): Promise<Map<string, Card>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from('public_profiles').select(CARD_FIELDS).in('id', unique);
  if (error) throw error;
  return new Map((data ?? []).map((c: any) => [c.id, c as Card]));
}

export async function getCard(userId: string): Promise<Card | null> {
  return (await cardsFor([userId])).get(userId) ?? null;
}

export async function findRunners(term: string): Promise<Card[]> {
  const uid = await currentUserId();
  let q = supabase.from('public_profiles').select(CARD_FIELDS).neq('id', uid).limit(30);
  const t = term.replace(/[%,()]/g, '').trim();
  if (t) q = q.or(`username.ilike.%${t}%,full_name.ilike.%${t}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Card[];
}

export async function getRelation(otherId: string): Promise<Relation> {
  const uid = await currentUserId();
  const lo = uid < otherId ? uid : otherId;
  const hi = uid < otherId ? otherId : uid;
  const [blk, fr, req] = await Promise.all([
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid).eq('blocked_id', otherId).maybeSingle(),
    supabase.from('friendships').select('user_low').eq('user_low', lo).eq('user_high', hi).maybeSingle(),
    supabase.from('friend_requests').select('id, sender_id')
      .eq('status', 'pending')
      .or(`and(sender_id.eq.${uid},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${uid})`)
      .maybeSingle(),
  ]);
  for (const r of [blk, fr, req]) if (r.error) throw r.error;
  if (blk.data) return { status: 'blocked', requestId: null };
  if (fr.data) return { status: 'friends', requestId: null };
  if (req.data) {
    return req.data.sender_id === uid
      ? { status: 'outgoing', requestId: req.data.id }
      : { status: 'incoming', requestId: req.data.id };
  }
  return { status: 'none', requestId: null };
}

export async function sendFriendRequest(userId: string) {
  const { data, error } = await supabase.rpc('send_friend_request', { p_recipient: userId, p_intro: null });
  if (error) throw error;
  return data as string;
}

export async function respondRequest(requestId: string, accept: boolean) {
  const { error } = await supabase.rpc('respond_friend_request', { p_request: requestId, p_accept: accept });
  if (error) throw error;
}

export async function removeFriend(userId: string) {
  const { error } = await supabase.rpc('remove_friend', { p_user: userId });
  if (error) throw error;
}

export async function openDirectChat(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_direct_conversation', { p_user: userId });
  if (error) throw error;
  return data as string;
}

export async function listSocial() {
  const uid = await currentUserId();
  const [fr, inc, out] = await Promise.all([
    supabase.from('friendships').select('user_low, user_high').or(`user_low.eq.${uid},user_high.eq.${uid}`),
    supabase.from('friend_requests').select('id, sender_id, intro_message')
      .eq('recipient_id', uid).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('friend_requests').select('id, recipient_id')
      .eq('sender_id', uid).eq('status', 'pending').order('created_at', { ascending: false }),
  ]);
  for (const r of [fr, inc, out]) if (r.error) throw r.error;

  const friendIds = (fr.data ?? []).map((f: any) => (f.user_low === uid ? f.user_high : f.user_low));
  const incomingRows = inc.data ?? [];
  const outgoingRows = out.data ?? [];
  const cards = await cardsFor([
    ...friendIds,
    ...incomingRows.map((r: any) => r.sender_id),
    ...outgoingRows.map((r: any) => r.recipient_id),
  ]);
  return {
    friends: friendIds.map(id => ({ id, card: cards.get(id) ?? null })),
    incoming: incomingRows.map((r: any) => ({ requestId: r.id, id: r.sender_id, intro: r.intro_message, card: cards.get(r.sender_id) ?? null })),
    outgoing: outgoingRows.map((r: any) => ({ requestId: r.id, id: r.recipient_id, card: cards.get(r.recipient_id) ?? null })),
  };
}

export async function listChats() {
  const uid = await currentUserId();
  const { data: mine, error } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', uid);
  if (error) throw error;
  const ids = (mine ?? []).map((m: any) => m.conversation_id);
  if (ids.length === 0) return [];

  const { data: convs, error: e2 } = await supabase.from('conversations').select('id').in('id', ids).eq('type', 'direct');
  if (e2) throw e2;
  const directIds = (convs ?? []).map((c: any) => c.id);
  if (directIds.length === 0) return [];

  const { data: others, error: e3 } = await supabase.from('conversation_members')
    .select('conversation_id, user_id').in('conversation_id', directIds).neq('user_id', uid);
  if (e3) throw e3;
  const cards = await cardsFor((others ?? []).map((o: any) => o.user_id));
  return directIds.map(cid => {
    const o = (others ?? []).find((x: any) => x.conversation_id === cid);
    return { conversationId: cid, otherId: o?.user_id ?? null, card: o ? cards.get(o.user_id) ?? null : null };
  });
}

export async function blockRunner(userId: string) {
  const uid = await currentUserId();
  const { error } = await supabase.from('user_blocks').insert({ blocker_id: uid, blocked_id: userId });
  if (error && error.code !== '23505') throw error;
}

export async function unblockRunner(userId: string) {
  const uid = await currentUserId();
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', uid).eq('blocked_id', userId);
  if (error) throw error;
}

export async function listBlocked() {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid);
  if (error) throw error;
  const ids = (data ?? []).map((b: any) => b.blocked_id);
  // Blocked accounts are hidden from public_profiles, so names are shown only when readable.
  const cards = await cardsFor(ids);
  return ids.map(id => ({ id, card: cards.get(id) ?? null }));
}

export async function reportRunner(userId: string, reason: string, details: string) {
  const { error } = await supabase.rpc('report_content', {
    p_type: 'user', p_id: userId, p_reason: reason, p_details: details || null,
  });
  if (error) throw error;
}

export async function getPrivacy() {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('profile_privacy_settings').select('*').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  if (data) return data;
  // Accounts created before the settings row existed get defaults created now.
  const { data: created, error: e2 } = await supabase
    .from('profile_privacy_settings')
    .upsert({ user_id: uid }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (e2) throw e2;
  return created;
}

export async function savePrivacy(patch: Record<string, unknown>) {
  const uid = await currentUserId();
  const { error } = await supabase.from('profile_privacy_settings')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', uid);
  if (error) throw error;
}

export const REPORT_REASONS: [string, string][] = [
  ['harassment', 'Harassment or bullying'],
  ['spam', 'Spam'],
  ['scam', 'Scam or fraud'],
  ['impersonation', 'Pretending to be someone else'],
  ['hate', 'Hate speech'],
  ['threat', 'Threats'],
  ['sexual_content', 'Sexual content'],
  ['doxxing', 'Sharing private information'],
  ['other', 'Something else'],
];
