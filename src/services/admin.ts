import { supabase } from '../lib/supabase';

// Counts use RLS-allowed reads. Admins can see all profiles, events and registrations.
export async function getDashboard() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const count = async (q: any) => {
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  };
  const [runners, newToday, events, upcoming, registrations, groups, reports, cases, appeals, suspended] = await Promise.all([
    count(supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null)),
    count(supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)),
    count(supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published')),
    count(supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published').gt('starts_at', now.toISOString())),
    count(supabase.from('event_registrations').select('user_id', { count: 'exact', head: true }).eq('status', 'confirmed')),
    count(supabase.from('running_groups').select('id', { count: 'exact', head: true }).eq('status', 'active')),
    count(supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open')),
    count(supabase.from('moderation_cases').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_review'])),
    count(supabase.from('moderation_appeals').select('id', { count: 'exact', head: true }).eq('status', 'open')),
    count(supabase.from('account_restrictions').select('id', { count: 'exact', head: true }).eq('restriction', 'account')),
  ]);
  return { runners, newToday, events, upcoming, registrations, groups, reports, cases, appeals, suspended };
}

export async function listPlatformAudit() {
  const { data, error } = await supabase.from('audit_log')
    .select('id, action, actor_role, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false }).limit(150);
  if (error) throw error;
  return data ?? [];
}

export async function listEventAudit() {
  const { data, error } = await supabase.from('event_audit')
    .select('id, action, event_id, actor_id, created_at, changes')
    .order('created_at', { ascending: false }).limit(150);
  if (error) throw error;
  return data ?? [];
}
