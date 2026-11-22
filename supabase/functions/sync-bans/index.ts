// Keeps the Supabase login ban in step with active account suspensions.
// It recomputes the true state from the database, so the request body only needs the user id.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  try {
    const { user_id } = await req.json();
    if (typeof user_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user_id)) return json({ error: 'bad request' }, 400);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const now = Date.now();
    const { data, error } = await sb.from('account_restrictions')
      .select('starts_at, ends_at')
      .eq('user_id', user_id)
      .eq('restriction', 'account');
    if (error) return json({ error: error.message }, 500);

    const banned = (data ?? []).some((r: any) =>
      new Date(r.starts_at).getTime() <= now && (!r.ends_at || new Date(r.ends_at).getTime() > now));

    const { error: e2 } = await sb.auth.admin.updateUserById(user_id, {
      ban_duration: banned ? '876000h' : 'none',
    });
    if (e2) return json({ error: e2.message }, 500);
    return json({ banned });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
