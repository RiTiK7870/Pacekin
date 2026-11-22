// Deletes the caller's personal data and auth identity. Runs with the service role on the server only.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// Removes every file under a user's folder in a bucket. Storage lists folders with no id.
// Event cover photos live in the organiser's "events" folder and are kept so events still show images.
async function removeUserFiles(sb: any, bucket: string, uid: string, skipTopFolders: string[] = []) {
  const files: string[] = [];
  async function walk(prefix: string, depth: number) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error || !data) return;
    for (const item of data) {
      if (depth === 1 && skipTopFolders.includes(item.name)) continue;
      const full = `${prefix}/${item.name}`;
      if (item.id) files.push(full);
      else await walk(full, depth + 1);
    }
  }
  await walk(uid, 1);
  for (let i = 0; i < files.length; i += 100) {
    await sb.storage.from(bucket).remove(files.slice(i, i + 100));
  }
  return files.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await anon.auth.getUser(token);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    // Keep event counts accurate before removing registrations.
    const { data: regs } = await admin.from('event_registrations')
      .select('event_id').eq('user_id', user.id).eq('status', 'confirmed');
    for (const r of regs ?? []) await admin.rpc('adjust_registered_count', { p_event: r.event_id, p_delta: -1 });

    // Stored files: profile photos and chat images. Route data is stored in the database and removed below.
    await removeUserFiles(admin, 'avatars', user.id, ['events']);
    await removeUserFiles(admin, 'chat-media', user.id);

    // Personal data rows. Cascades cover most related tables.
    await admin.from('run_routes').delete().eq('user_id', user.id);
    await admin.from('runs').delete().eq('user_id', user.id);
    await admin.from('ai_preferences').delete().eq('user_id', user.id);
    await admin.from('event_registrations').delete().eq('user_id', user.id);
    await admin.from('push_tokens').delete().eq('user_id', user.id);
    await admin.from('notifications').delete().eq('user_id', user.id);

    // Events the user organised stay published; they just lose the organiser link.
    await admin.from('events').update({ created_by: null, updated_by: null }).eq('created_by', user.id);
    await admin.from('events').update({ updated_by: null }).eq('updated_by', user.id);

    await admin.from('profiles').delete().eq('id', user.id);

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return json({ error: 'Could not remove sign-in identity' }, 500);
    return json({ ok: true });
  } catch (e) {
    console.error('delete-account failed', e);
    return json({ error: 'Server error' }, 500);
  }
});
