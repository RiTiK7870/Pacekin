import { supabase } from '../lib/supabase';

export async function listEvents({ search = '', category }: { search?: string; category?: string } = {}) {
  let q = supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .order('starts_at', { ascending: true })
    .limit(40);
  const term = search.replace(/[%,()]/g, '').trim();
  if (term) q = q.or(`title.ilike.%${term}%,city.ilike.%${term}%`);
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) throw error;
  const now = Date.now();
  return (data ?? []).filter(e => !e.ends_at || new Date(e.ends_at).getTime() > now);
}

export async function fetchEvent(id: string) {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export type RegStatus = 'confirmed' | 'waitlisted' | 'pending_review' | 'approved' | 'rejected';

export async function myRegistration(eventId: string): Promise<RegStatus | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('event_registrations')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', user!.id)
    .in('status', ['confirmed', 'waitlisted', 'pending_review', 'approved', 'rejected'])
    .maybeSingle();
  return (data?.status as RegStatus) ?? null;
}

// Free events: returns 'joined' | 'waitlisted' | 'already_joined'.
// Paid events: confirms an approved runner (server enforces approval).
export async function joinEvent(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_event', { p_event: id });
  if (error) throw error;
  return (data as string) ?? 'joined';
}

export async function leaveEvent(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('leave_event', { p_event: id });
  if (error) throw error;
  return (data as string) ?? 'left';
}

export async function applyPaidEvent(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('apply_paid_event', { p_event: id });
  if (error) throw error;
  return (data as string) ?? 'applied';
}
