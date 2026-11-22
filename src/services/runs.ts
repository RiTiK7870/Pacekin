import { supabase } from '../lib/supabase';
import type { Pt } from '../lib/geo';

export async function saveRun(r: { startedAt: Date; endedAt: Date; distanceM: number; durationS: number; points: Pt[] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  // The DB trigger forces user_id and computes `verified`; the client cannot self-verify.
  const { data, error } = await supabase.from('runs').insert({
    source: 'gps',
    started_at: r.startedAt.toISOString(),
    ended_at: r.endedAt.toISOString(),
    distance_m: Math.round(r.distanceM),
    duration_s: r.durationS,
  }).select('id').single();
  if (error) throw error;
  const { error: e2 } = await supabase.from('run_routes').insert({ run_id: data.id, user_id: user.id, points: r.points });
  if (e2) throw e2;
}

export async function listRuns(limit = 30) {
  const { data, error } = await supabase
    .from('runs').select('id,distance_m,duration_s,started_at,verified,source')
    .order('started_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Display-only totals. PRD 10.2: authoritative streaks must be computed server-side. */
export async function fetchStats() {
  const { data, error } = await supabase
    .from('runs').select('distance_m,started_at').eq('verified', true)
    .order('started_at', { ascending: false }).limit(500);
  if (error) throw error;
  const rows = data ?? [];
  const days = new Set(rows.map(r => dayKey(new Date(r.started_at))));
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  return {
    km: Math.round((rows.reduce((a, r) => a + r.distance_m, 0) / 1000) * 10) / 10,
    runs: rows.length,
    streak,
  };
}
