import { supabase } from '../lib/supabase';

// The suspension action on the signed-in account and any appeal already sent for it.
export async function getSuspensionAppeal() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: action, error } = await supabase
    .from('moderation_actions').select('id, reason, created_at')
    .eq('target_user_id', user.id).eq('action', 'suspend')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!action) return null;
  const { data: appeal, error: e2 } = await supabase
    .from('moderation_appeals').select('status')
    .eq('action_id', action.id).eq('user_id', user.id).maybeSingle();
  if (e2) throw e2;
  return { action, appeal };
}
