// Automated screening for chat messages and profile bios.
// Called by the database after insert/update (see pacekin_safety_and_legal.sql).
// Rules run first; the AI classifier adds context. High-risk content is hidden pending review.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const CATS = ['none', 'harassment', 'threat', 'hate', 'spam', 'scam', 'sexual_content', 'self_harm', 'doxxing', 'other'];

// Deterministic first pass. Short by design: extend as moderators review cases.
const THREAT = [/\bkill (you|u|them)\b/, /\bi will (hurt|hunt|find|kill) (you|u)\b/];
const SELF_HARM = [/\bkys\b/, /\bkill (my)?self\b/];
const ABUSE = [/\bf+u+c+k+\w*/, /\bb+i+t+c+h+\w*/, /\bs+h+i+t+\w*/, /\bidiot\b/];

// Normalises leetspeak and symbols so "f*ck" or "f.u.c.k" still match.
function normalise(s: string) {
  return s.toLowerCase()
    .replace(/@/g, 'a').replace(/\$/g, 's').replace(/0/g, 'o').replace(/1/g, 'i')
    .replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function ruleCheck(text: string): { severity: number; category: string } {
  const n = normalise(text);
  if (THREAT.some(r => r.test(n))) return { severity: 3, category: 'threat' };
  if (SELF_HARM.some(r => r.test(n))) return { severity: 2, category: 'self_harm' };
  if (ABUSE.some(r => r.test(n))) return { severity: 2, category: 'harassment' };
  return { severity: 0, category: 'none' };
}

const SYSTEM = `You classify short messages from a running community app.
Reply ONLY with JSON: {"category": one of [none, harassment, threat, hate, spam, scam, sexual_content, self_harm, doxxing, other], "severity": integer 0-3, "confidence": number 0-1}.
Severity 3: credible threats, hate, sexual exploitation, doxxing, or encouragement of self-harm.
Severity 2: insults, harassment, scams or fake events.
Severity 1: spam, promotion or mildly inappropriate content.
Severity 0: fine. Discussing, quoting or asking for help about a sensitive topic is not abuse.`;

async function classify(text: string) {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) return null;
  const model = Deno.env.get('OPENROUTER_MODEL') ?? 'openai/gpt-4o-mini';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 120,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text.slice(0, 2000) },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const raw = String(body.choices?.[0]?.message?.content ?? '');
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    return {
      category: CATS.includes(j.category) ? j.category : 'other',
      severity: Math.min(3, Math.max(0, Math.round(Number(j.severity) || 0))),
      confidence: Math.min(1, Math.max(0, Number(j.confidence) || 0)),
      model,
    };
  } catch {
    return null; // fall back to rules only
  } finally {
    clearTimeout(timer);
  }
}

const REASONS = ['harassment', 'threat', 'hate', 'spam', 'scam', 'sexual_content', 'self_harm', 'doxxing', 'other'];

Deno.serve(async (req) => {
  try {
    const { target_type, target_id } = await req.json();
    if (!['message', 'profile_bio'].includes(target_type) || typeof target_id !== 'string') {
      return json({ error: 'bad request' }, 400);
    }
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const { data: flag } = await sb.from('app_config').select('value').eq('key', 'moderation.enabled').maybeSingle();
    if (flag && flag.value === false) return json({ skipped: 'disabled' });

    let text = '';
    let ownerId: string | null = null;
    let messageId: string | null = null;
    if (target_type === 'message') {
      const { data } = await sb.from('messages').select('id, body, sender_id').eq('id', target_id).maybeSingle();
      if (!data?.body) return json({ skipped: 'no text' });
      text = data.body; ownerId = data.sender_id; messageId = data.id;
    } else {
      const { data } = await sb.from('profiles').select('id, bio').eq('id', target_id).maybeSingle();
      if (!data?.bio) return json({ skipped: 'no text' });
      text = data.bio; ownerId = data.id;
    }

    const rule = ruleCheck(text);
    const ai = await classify(text);
    let sev = rule.severity;
    let category = rule.category;
    let source = 'rule';
    if (ai && ai.confidence >= 0.6 && ai.severity > sev) {
      sev = ai.severity; category = ai.category; source = 'ai';
    }
    const reason = REASONS.includes(category) ? category : 'other';

    await sb.from('moderation_classifications').insert({
      target_type: messageId ? 'message' : 'user',
      target_id,
      category: sev ? reason : 'none',
      severity: sev,
      confidence: ai?.confidence ?? null,
      recommended_action: sev >= 3 ? 'hide' : sev === 2 ? 'review' : 'none',
      model: ai?.model ?? 'rules',
      raw: { rule: rule.category, ai: ai ?? null },
    });

    if (sev === 0) return json({ severity: 0 });

    const targetType = messageId ? 'message' : 'user';
    const { data: rep } = await sb.from('reports').insert({
      reporter_id: null,
      target_type: targetType,
      target_id,
      reason,
      details: `Automated screening (${source})`,
    }).select('id').single();

    if (messageId && rep) {
      await sb.from('message_evidence').insert({ message_id: messageId, body_snapshot: text, captured_by: null, report_id: rep.id });
    }
    await sb.from('moderation_cases').insert({
      report_id: rep?.id ?? null,
      target_type: targetType,
      target_id,
      category: reason,
      severity: sev,
      confidence: ai?.confidence ?? null,
      source,
      priority: sev >= 3 ? 'urgent' : sev === 2 ? 'high' : 'normal',
    });

    if (sev >= 3) {
      if (messageId) await sb.from('messages').update({ moderation_status: 'hidden' }).eq('id', messageId);
      else await sb.from('profiles').update({ bio: null }).eq('id', target_id);
      if (ownerId) {
        await sb.from('notifications').insert({
          user_id: ownerId,
          type: 'moderation_notice',
          title: 'Content held for review',
          body: 'Something you posted was hidden pending a moderator review. You can appeal once a decision is made.',
          data: {},
        });
      }
    }
    return json({ severity: sev, category: reason, action: sev >= 3 ? 'hidden' : 'queued' });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
