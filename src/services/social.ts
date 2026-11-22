import { supabase } from '../lib/supabase';

export type Period = 'daily' | 'weekly' | 'monthly' | 'all_time';

// Verified runs only, calculated on the server. Always includes the caller's own row.
export async function getLeaderboard(period: Period) {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_period: period, p_limit: 10 });
  if (error) throw error;
  return data ?? [];
}

// Badge catalogue, the caller's unlocked badges, streak and personal records.
export async function getAchievements() {
  const [badgesRes, earnedRes, streakRes, recordsRes] = await Promise.all([
    supabase.from('badges')
      .select('code, name, description, icon, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('user_badges').select('badge_code, unlocked_at'),
    supabase.from('user_streaks').select('current_streak, longest_streak, total_active_days').maybeSingle(),
    supabase.from('personal_records').select('category, value, achieved_at'),
  ]);
  if (badgesRes.error) throw badgesRes.error;
  if (earnedRes.error) throw earnedRes.error;
  if (streakRes.error) throw streakRes.error;
  if (recordsRes.error) throw recordsRes.error;

  const earned = new Map((earnedRes.data ?? []).map(e => [e.badge_code, e.unlocked_at as string]));
  return {
    badges: (badgesRes.data ?? []).map(b => ({ ...b, unlockedAt: earned.get(b.code) ?? null })),
    streak: streakRes.data,
    records: recordsRes.data ?? [],
  };
}
