// Server-side AI Coach. The OpenRouter key is read from a Supabase secret, never from the app.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = `You are Pacekin AI Coach, a friendly running companion.
Give general, encouraging guidance only. Use ONLY the context provided; never invent distances, times, routes, events or rankings.
If data is missing, say so. Never give medical diagnoses or treatment. For pain, injury or symptoms, advise seeing a qualified professional.
Keep answers under 150 words.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    if (!token) return json({ error: 'Not signed in' }, 401);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: 'Session expired. Sign out and sign in again.' }, 401);

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) return json({ error: 'OPENROUTER_API_KEY secret is not set on Supabase' }, 500);

    const { message } = await req.json();
    if (typeof message !== 'string' || !message.trim() || message.length > 1000) {
      return json({ error: 'Invalid message' }, 400);
    }

    const { data: pref, error: prefErr } = await sb.from('ai_preferences')
      .select('enabled, personalization_consent').eq('user_id', user.id).maybeSingle();
    if (prefErr) return json({ error: 'Preferences error: ' + prefErr.message }, 500);
    if (!pref?.enabled) return json({ error: 'AI Coach is turned off in settings' }, 403);

    const { data: allowed, error: quotaErr } = await sb.rpc('ai_check_quota', { p_tokens: 0 });
    if (quotaErr) return json({ error: 'Quota check failed: ' + quotaErr.message }, 500);
    if (!allowed) return json({ error: 'Daily AI limit reached. Try again tomorrow.' }, 429);

    // Minimum necessary context: aggregates only, no GPS points, no identifiers.
    let context = 'The user has not consented to personalization. Answer generally.';
    if (pref.personalization_consent) {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data: runs } = await sb.from('runs').select('distance_m, duration_s')
        .eq('verified', true).gte('started_at', since).limit(200);
      const rows = runs ?? [];
      const km = rows.reduce((a, r) => a + r.distance_m, 0) / 1000;
      const mins = rows.reduce((a, r) => a + r.duration_s, 0) / 60;
      context = `Last 30 days, verified GPS runs only: ${rows.length} runs, ${km.toFixed(1)} km, ${mins.toFixed(0)} minutes total.`;
    }

    const model = Deno.env.get('OPENROUTER_MODEL') ?? 'openai/gpt-4o-mini';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let res: Response;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'system', content: `User context: ${context}` },
            { role: 'user', content: message.trim() },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return json({ error: `OpenRouter returned ${res.status}: ${detail}` }, 502);
    }
    const body = await res.json();
    const reply = String(body.choices?.[0]?.message?.content ?? '').slice(0, 4000);
    if (!reply) return json({ error: 'The model returned an empty reply' }, 502);
    return json({ reply });
  } catch (e) {
    return json({ error: 'Server error: ' + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
