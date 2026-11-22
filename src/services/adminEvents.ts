import { supabase } from '../lib/supabase';

// Admin-only. RLS on public.events allows insert/update/delete only for role = 'admin'.
export async function listAllEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,category,status,lifecycle,starts_at,capacity,registered_count,city')
    .order('starts_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getEvent(id: string) {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function saveEvent(id: string | null, values: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const now = new Date().toISOString();
  if (id) {
    const { error } = await supabase
      .from('events')
      .update({ ...values, updated_by: user.id, updated_at: now })
      .eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from('events')
    .insert({ ...values, created_by: user.id, updated_by: user.id, reg_opens_at: now })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

// Runner details shown only to the organiser (admin). RLS: admins can read profiles and registrations.
export async function listRegistrants(eventId: string) {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('user_id, created_at, profiles!event_registrations_user_id_fkey(full_name, username, city, date_of_birth, gender, experience_level, preferred_distance, avatar_url)')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true });
  if (error) throw error;

  const { data: checks, error: checkErr } = await supabase
    .from('event_checkins')
    .select('user_id')
    .eq('event_id', eventId);
  if (checkErr) throw checkErr;
  const done = new Set((checks ?? []).map(c => c.user_id));

  return (data ?? []).map((r: any) => ({
    userId: r.user_id as string,
    joinedAt: r.created_at as string,
    checkedIn: done.has(r.user_id),
    ...(r.profiles ?? {}),
  }));
}

export async function setCheckIn(eventId: string, userId: string, on: boolean) {
  if (on) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('event_checkins').upsert(
      { event_id: eventId, user_id: userId, checked_in_by: user?.id },
      { onConflict: 'event_id,user_id', ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('event_checkins').delete()
      .eq('event_id', eventId).eq('user_id', userId);
    if (error) throw error;
  }
}

export function ageOf(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// Uploads a cover photo to the user's own folder in the avatars bucket (existing policy: <user_id>/...).
export async function uploadEventCover(localUri: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const res = await fetch(localUri);
  const bytes = await res.arrayBuffer();
  const path = `${user.id}/events/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function listApplications(eventId: string) {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('user_id, status, payment_status, application_note, created_at, profiles!event_registrations_user_id_fkey(full_name, username, city, date_of_birth, gender, experience_level, preferred_distance, avatar_url)')
    .eq('event_id', eventId)
    .in('status', ['pending_review', 'approved'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    userId: r.user_id as string,
    status: r.status as string,
    paymentStatus: r.payment_status as string,
    note: r.application_note as string | null,
    joinedAt: r.created_at as string,
    ...(r.profiles ?? {}),
  }));
}

export async function reviewApplication(eventId: string, userId: string, approve: boolean) {
  const { error } = await supabase.rpc('review_application', { p_event: eventId, p_user: userId, p_approve: approve });
  if (error) throw error;
}

export async function setPaymentStatus(eventId: string, userId: string, paid: boolean) {
  const { error } = await supabase.rpc('set_payment_status', { p_event: eventId, p_user: userId, p_paid: paid });
  if (error) throw error;
}
