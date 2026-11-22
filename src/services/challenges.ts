import { supabase } from '../lib/supabase';

export type Metric = 'distance_m' | 'runs';

// Active challenges plus the signed-in runner's participation.
export async function listChallenges() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('challenges').select('*')
    .eq('status', 'active')
    .order('period_end', { ascending: true });
  if (error) throw error;
  const { data: mine, error: e2 } = await supabase
    .from('challenge_participants').select('challenge_id, progress, completed_at')
    .eq('user_id', user!.id);
  if (e2) throw e2;
  const map = new Map((mine ?? []).map(m => [m.challenge_id, m]));
  return (data ?? []).map(c => ({ ...c, mine: map.get(c.id) ?? null }));
}

// Joining counts the runner's verified runs already inside the challenge period.
export async function joinChallenge(c: any) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: runs, error } = await supabase
    .from('runs').select('distance_m')
    .eq('user_id', user!.id)
    .eq('verified', true)
    .eq('flagged', false)
    .is('deleted_at', null)
    .gte('started_at', c.period_start)
    .lt('started_at', c.period_end);
  if (error) throw error;
  const rows = runs ?? [];
  const progress = c.metric === 'distance_m'
    ? rows.reduce((a, r) => a + r.distance_m, 0)
    : rows.length;
  const done = progress >= c.target;
  const { error: e2 } = await supabase.from('challenge_participants').insert({
    challenge_id: c.id,
    user_id: user!.id,
    progress,
    completed_at: done ? new Date().toISOString() : null,
  });
  if (e2) throw e2;
}

export async function leaveChallenge(challengeId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('challenge_participants').delete()
    .eq('challenge_id', challengeId).eq('user_id', user!.id);
  if (error) throw error;
}

// Admin only (RLS: challenges_admin_write).
export async function adminListChallenges() {
  const { data, error } = await supabase.from('challenges').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function saveChallenge(id: string | null, values: Record<string, unknown>) {
  if (id) {
    const { error } = await supabase.from('challenges').update(values).eq('id', id);
    if (error) throw error;
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('challenges').insert({ ...values, created_by: user?.id });
  if (error) throw error;
}
