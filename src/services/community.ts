import { supabase } from '../lib/supabase';

// Room types that are open to everyone. Group rooms are joined through their group instead.
export const COMMUNITY_TYPES = ['system', 'general', 'beginner', 'distance', 'local', 'challenge'];

export async function listCommunityRooms() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('id, name, description, room_type, conversation_id')
    .eq('visibility', 'public')
    .eq('status', 'active')
    .in('room_type', COMMUNITY_TYPES)
    .order('name', { ascending: true });
  if (error) throw error;
  const { data: mem, error: e2 } = await supabase
    .from('conversation_members').select('conversation_id').eq('user_id', user!.id);
  if (e2) throw e2;
  const joined = new Set((mem ?? []).map((m: any) => m.conversation_id));
  return (data ?? []).map((r: any) => ({ ...r, joined: joined.has(r.conversation_id) }));
}

// Server enforces restrictions and rate limits.
export async function joinCommunityRoom(roomId: string) {
  const { error } = await supabase.rpc('join_public_room', { p_room: roomId });
  if (error) throw error;
}

export async function reportMessage(messageId: string, reason: string) {
  const { error } = await supabase.rpc('report_content', {
    p_type: 'message', p_id: messageId, p_reason: reason, p_details: null,
  });
  if (error) throw error;
}
