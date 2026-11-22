import { supabase } from '../lib/supabase';

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

// ---- Staff (admin and moderator) -------------------------------------------
export async function listOpenCases() {
  const { data, error } = await supabase
    .from('moderation_cases')
    .select('id, target_type, target_id, category, severity, priority, status, source, created_at')
    .in('status', ['open', 'in_review'])
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  return (data ?? []).sort((a: any, b: any) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
}

export async function getCaseDetail(caseId: string) {
  const { data: c, error } = await supabase.from('moderation_cases').select('*').eq('id', caseId).single();
  if (error) throw error;

  const [acts, report, evidence, target] = await Promise.all([
    supabase.from('moderation_actions').select('action, reason, created_at').eq('case_id', caseId).order('created_at', { ascending: false }),
    c.report_id
      ? supabase.from('reports').select('reason, details, created_at').eq('id', c.report_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    c.report_id
      ? supabase.from('message_evidence').select('body_snapshot, captured_at').eq('report_id', c.report_id)
      : Promise.resolve({ data: [], error: null }),
    c.target_type === 'user'
      ? supabase.from('profiles').select('full_name, username, city').eq('id', c.target_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [acts, report, evidence, target]) if (r.error) throw r.error;

  return {
    case: c,
    actions: acts.data ?? [],
    report: report.data,
    evidence: evidence.data ?? [],
    targetProfile: target.data,
  };
}

// The server derives the target from the case, so the client only chooses the action.
export async function applyCaseAction(caseId: string, action: string, reason: string) {
  const { error } = await supabase.rpc('apply_moderation_action', { p_case: caseId, p_action: action, p_reason: reason });
  if (error) throw error;
}

export async function listOpenAppeals() {
  const { data, error } = await supabase
    .from('moderation_appeals')
    .select('id, statement, created_at, action_id, moderation_actions!moderation_appeals_action_id_fkey(action, reason, case_id), profiles!moderation_appeals_user_id_fkey(full_name, username)')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function resolveAppeal(appealId: string, outcome: 'upheld' | 'overturned') {
  const { error } = await supabase.rpc('resolve_appeal', { p_appeal: appealId, p_outcome: outcome });
  if (error) throw error;
}

// ---- Runner's own standing -------------------------------------------------
const USER_VISIBLE_ACTIONS = ['warn', 'hide', 'remove', 'restrict_chat', 'suspend', 'restore'];

export async function getStanding() {
  const uid = await currentUserId();
  const [strikes, restrictions, actions] = await Promise.all([
    supabase.from('user_strikes').select('reason, severity, created_at, expires_at').eq('user_id', uid).order('created_at', { ascending: false }),
    supabase.from('account_restrictions').select('restriction, reason, starts_at, ends_at').eq('user_id', uid).order('starts_at', { ascending: false }),
    supabase.from('moderation_actions').select('id, action, reason, created_at').eq('target_user_id', uid).order('created_at', { ascending: false }),
  ]);
  for (const r of [strikes, restrictions, actions]) if (r.error) throw r.error;

  const visible = (actions.data ?? []).filter((a: any) => USER_VISIBLE_ACTIONS.includes(a.action));
  const ids = visible.map((a: any) => a.id);
  const { data: appeals, error } = ids.length
    ? await supabase.from('moderation_appeals').select('action_id, status').eq('user_id', uid).in('action_id', ids)
    : { data: [], error: null };
  if (error) throw error;

  return {
    strikes: strikes.data ?? [],
    restrictions: restrictions.data ?? [],
    actions: visible.map((a: any) => ({ ...a, appeal: (appeals ?? []).find((x: any) => x.action_id === a.id) ?? null })),
  };
}

export async function submitAppeal(actionId: string, statement: string) {
  const { error } = await supabase.rpc('submit_appeal', { p_action: actionId, p_statement: statement });
  if (error) throw error;
}
