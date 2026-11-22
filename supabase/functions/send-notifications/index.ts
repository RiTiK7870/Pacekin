// Sends unpushed in-app notifications to devices through the Expo push service.
// Called every minute by pg_cron (see pacekin_paid_and_notifications.sql).
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: pending, error } = await sb.from('notifications')
    .select('id, user_id, title, body, data')
    .is('pushed_at', null)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ sent: 0 });

  const userIds = [...new Set(pending.map(n => n.user_id))];
  const { data: tokens } = await sb.from('push_tokens').select('user_id, token').in('user_id', userIds);
  const byUser = new Map<string, string[]>();
  for (const t of tokens ?? []) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);

  const messages: any[] = [];
  for (const n of pending) {
    for (const token of byUser.get(n.user_id) ?? []) {
      messages.push({
        to: token,
        title: n.title,
        body: n.body ?? '',
        data: { ...(n.data ?? {}), notificationId: n.id },
        sound: 'default',
        priority: 'high',
      });
    }
  }

  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const body = await res.json().catch(() => ({}));
    (body.data ?? []).forEach((ticket: any, idx: number) => {
      if (ticket.status === 'ok') sent++;
      else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].to);
    });
  }

  if (dead.length) await sb.from('push_tokens').delete().in('token', dead);
  // Mark everything handled, including users without a device, so nothing is retried forever.
  await sb.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', pending.map(n => n.id));

  return json({ sent, notifications: pending.length });
});
