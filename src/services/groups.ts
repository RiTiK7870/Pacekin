import { supabase } from '../lib/supabase';

export const GROUP_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
export const GROUP_DISTANCES = ['1–3 km', '5 km', '10 km', 'Half marathon', 'Full marathon'];

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}


// Other runners' names and photos are only readable through public_profiles (privacy-filtered).
// The caller's own profile is read directly, so their name always shows.
const PROFILE_FIELDS = 'id, full_name, username, city, avatar_url, experience_level';
export async function profilesFor(ids: string[]): Promise<Map<string, any>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, any>();
  if (unique.length === 0) return map;
  const { data, error } = await supabase.from('public_profiles').select(PROFILE_FIELDS).in('id', unique);
  if (error) throw error;
  (data ?? []).forEach((p: any) => map.set(p.id, p));
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (uid && unique.includes(uid) && !map.has(uid)) {
    const { data: own } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', uid).maybeSingle();
    if (own) map.set(uid, own);
  }
  return map;
}

// Public groups only. Private groups are visible to their members.
export async function discoverGroups(search: string) {
  let q = supabase
    .from('running_groups')
    .select('id, name, city, running_level, preferred_distances, visibility')
    .eq('status', 'active')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(50);
  const term = search.replace(/[%,()]/g, '').trim();
  if (term) q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function myGroups() {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('group_members')
    .select('role, running_groups(id, name, city, running_level, visibility)')
    .eq('user_id', uid);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r.running_groups, myRole: r.role }))
    .filter((g: any) => g.id);
}

export async function getGroupDetail(groupId: string) {
  const uid = await currentUserId();
  const [groupRes, membersRes, roomsRes, requestsRes, myReqRes] = await Promise.all([
    supabase.from('running_groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('user_id, role, joined_at')
      .eq('group_id', groupId).order('joined_at', { ascending: true }),
    supabase.from('chat_rooms').select('id, name, description, conversation_id')
      .eq('group_id', groupId).eq('status', 'active'),
    supabase.from('group_join_requests').select('id, user_id, message, created_at')
      .eq('group_id', groupId).eq('status', 'pending').order('created_at', { ascending: true }),
    supabase.from('group_join_requests').select('id')
      .eq('group_id', groupId).eq('user_id', uid).eq('status', 'pending').maybeSingle(),
  ]);
  for (const r of [groupRes, membersRes, roomsRes, requestsRes, myReqRes]) {
    if (r.error) throw r.error;
  }
  const memberRows = membersRes.data ?? [];
  const requestRows = requestsRes.data ?? [];
  const profiles = await profilesFor([
    ...memberRows.map((m: any) => m.user_id),
    ...requestRows.map((r: any) => r.user_id),
  ]);

  const members = memberRows.map((m: any) => ({
    ...(profiles.get(m.user_id) ?? {}),
    user_id: m.user_id,
    userId: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
  }));
  const requests = requestRows.map((r: any) => ({
    ...(profiles.get(r.user_id) ?? {}),
    id: r.id,
    user_id: r.user_id,
    message: r.message,
    created_at: r.created_at,
  }));
  const myRole = members.find((m: any) => m.user_id === uid)?.role ?? null;
  return {
    group: groupRes.data,
    members,
    rooms: roomsRes.data ?? [],
    requests,
    myRole: myRole as 'owner' | 'admin' | 'member' | null,
    myRequestPending: !!myReqRes.data,
  };
}

export async function createGroup(values: Record<string, unknown>) {
  const uid = await currentUserId();
  // No .select() here: the owner's membership is added by a trigger after the insert.
  const { error } = await supabase.from('running_groups').insert({ ...values, owner_id: uid });
  if (error) throw error;
  const { data, error: e2 } = await supabase.from('running_groups').select('id')
    .eq('owner_id', uid).order('created_at', { ascending: false }).limit(1).single();
  if (e2) throw e2;
  return data.id as string;
}

export async function updateGroup(groupId: string, values: Record<string, unknown>) {
  const { error } = await supabase.from('running_groups').update(values).eq('id', groupId);
  if (error) throw error;
}

export async function joinGroup(groupId: string, message?: string) {
  const { data, error } = await supabase.rpc('join_group', { p_group: groupId, p_message: message ?? null });
  if (error) throw error;
  return data as string;
}

export async function leaveGroup(groupId: string) {
  const uid = await currentUserId();
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', uid);
  if (error) throw error;
}

export async function reviewJoinRequest(requestId: string, approve: boolean) {
  const { error } = await supabase.rpc('approve_group_request', { p_req: requestId, p_approve: approve });
  if (error) throw error;
}

export async function removeMember(groupId: string, userId: string) {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}

// Owner only (RLS: group_members_owner_update).
export async function setMemberRole(groupId: string, userId: string, role: 'admin' | 'member') {
  const { error } = await supabase.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}

export async function createGroupRoom(groupId: string, name: string, description: string) {
  const { data, error } = await supabase.rpc('create_group_room', { p_group: groupId, p_name: name, p_description: description });
  if (error) throw error;
  return data as string;
}

export async function joinGroupRoom(roomId: string) {
  const { error } = await supabase.rpc('join_group_room', { p_room: roomId });
  if (error) throw error;
}

// ---- Group chat -------------------------------------------------------------
export async function listMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, body, created_at, sender_id')
    .eq('conversation_id', conversationId)
    .eq('moderation_status', 'visible')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  const rows = data ?? [];
  const profiles = await profilesFor(rows.map((m: any) => m.sender_id));
  return rows.map((m: any) => ({ ...m, profiles: profiles.get(m.sender_id) ?? null }));
}

export async function sendMessage(conversationId: string, body: string) {
  const uid = await currentUserId();
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: uid, body });
  if (error) throw error;
}
