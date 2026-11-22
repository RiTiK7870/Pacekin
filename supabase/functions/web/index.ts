// Public web pages: privacy policy, terms, account deletion, and the home page.
// Deploy with --no-verify-jwt so anyone can open the pages.
const SUPPORT = Deno.env.get('SUPPORT_EMAIL') ?? 'support@example.com';

const CSS = `body{font-family:system-ui,Arial,sans-serif;max-width:760px;margin:0 auto;padding:24px;color:#0F172A;line-height:1.65}
h1{color:#0E3B2E}h2{color:#0E3B2E;font-size:18px;margin-top:28px}a{color:#059669}
.draft{background:#FEF3C7;color:#92400E;padding:10px 14px;border-radius:8px;font-size:14px}
.btn{display:inline-block;background:#0E3B2E;color:#fff;border:0;padding:12px 18px;border-radius:10px;font-size:15px;cursor:pointer;margin-top:8px}
.btn:disabled{opacity:.45;cursor:not-allowed}.danger{background:#DC2626}
.muted{color:#64748B;font-size:14px}.card{background:#F3F6F4;border-radius:12px;padding:18px;margin:16px 0}`;

const shell = (title: string, body: string, extraScript = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Pacekin</title><style>${CSS}</style></head>
<body>${body}
<p class="muted" style="margin-top:40px"><a href="?page=privacy">Privacy policy</a> · <a href="?page=terms">Terms</a> · <a href="?page=delete">Delete account</a> · <a href="mailto:${SUPPORT}">${SUPPORT}</a></p>
${extraScript}</body></html>`;

const PRIVACY = `
<h1>Privacy policy</h1>
<p class="draft">Draft for launch. This text must be reviewed by a qualified lawyer before it is published.</p>
<p>Pacekin ("we") runs the Pacekin running app. This policy explains what we collect, why, and the choices you have. Contact us at <a href="mailto:${SUPPORT}">${SUPPORT}</a>.</p>

<h2>1. What we collect</h2>
<ul>
<li><b>Account:</b> your Google sign-in identifier and email address, plus the details you add: name, username, city, date of birth, gender, bio, photo, experience level and running goals.</li>
<li><b>Running data:</b> GPS points and routes for runs you record, distance, time, pace, streaks, badges and personal records.</li>
<li><b>Community content:</b> messages, reports, group and event activity, join requests and friend requests.</li>
<li><b>AI Coach:</b> the questions you type and, only if you agree, aggregate totals from your verified runs.</li>
<li><b>Device and safety:</b> notification settings, moderation records and appeals.</li>
</ul>

<h2>2. Location</h2>
<p>We use location only while you record a run in the app, after you give permission. Routes are private by default. We never show your live location to other runners.</p>

<h2>3. How we use it</h2>
<p>To run the app: sign you in, verify runs, calculate leaderboards and challenges using verified distance only, send notifications, keep the community safe, and meet legal obligations.</p>

<h2>4. Who we share it with</h2>
<ul>
<li><b>Other runners:</b> only the profile fields you choose to show. Your city shows only if you allow it.</li>
<li><b>Event organisers:</b> name, age, city, gender and experience for runners who join the organiser's event, so they can identify runners at the start.</li>
<li><b>Service providers:</b> Supabase (hosting, database, sign-in and storage), OpenRouter (AI Coach replies and automated content screening; we send only the text needed), and Google (sign-in).</li>
</ul>
<p>We do not sell personal data and do not show advertising.</p>

<h2>5. Automated screening</h2>
<p>Chat messages and profile bios are checked automatically for abuse and threats. High-risk content may be hidden until a moderator reviews it. You can appeal decisions in the app under Account standing.</p>

<h2>6. How long we keep data</h2>
<p>We keep your data while your account exists. After you delete your account, we delete your personal data, photos and routes. Backups are removed within 30 days. Moderation records (reports, decisions and appeals) are kept for up to 180 days after a case closes, or longer where the law requires it. Messages you sent remain in group or chat history, with your name and text removed.</p>

<h2>7. Your choices</h2>
<p>You can edit your profile, change privacy settings, block or report runners, turn off AI personalisation, and delete your account in the app or on our <a href="?page=delete">account deletion page</a>. To request a copy of your data, email us.</p>

<h2>8. Children</h2>
<p>Pacekin is for people aged 16 and over. Accounts for people under 18 cannot send direct messages or appear in runner search.</p>

<h2>9. Security</h2>
<p>We protect data in transit and restrict access by role. No system is completely secure, so please use a strong Google account.</p>

<h2>10. Changes</h2>
<p>We will tell you in the app before material changes take effect.</p>`;

const TERMS = `
<h1>Terms and conditions</h1>
<p class="draft">Draft for launch. This text must be reviewed by a qualified lawyer before it is published.</p>
<p>By using Pacekin you agree to these terms. Contact <a href="mailto:${SUPPORT}">${SUPPORT}</a> with questions.</p>

<h2>1. Eligibility</h2>
<p>You must be at least 16 years old. You must provide accurate information and keep your sign-in secure.</p>

<h2>2. Running safety</h2>
<p>Running carries physical risk. You take part at your own risk and should check that you are fit to run. AI Coach suggestions are general information, not medical advice. For pain, injury or symptoms, see a qualified professional. Meet in public places and tell someone where you are going.</p>

<h2>3. Official events</h2>
<p>Official events are created only by Pacekin administrators. Where an event is marked paid, the entry fee and any prizes are arranged between the runner and the organiser as shown on the event. Pacekin does not collect entry fees or award prizes unless the event states otherwise. Refund and cancellation rules are set by the organiser and shown on the event.</p>

<h2>4. Community conduct</h2>
<p>You must not harass, threaten, impersonate, scam, spam, share private information about others, post sexual content, or encourage self-harm or dangerous challenges. You must not pretend to be a Pacekin administrator or post fake events.</p>

<h2>5. Your content</h2>
<p>You keep ownership of what you post. You give us permission to store and display it within the app so the service works. We may remove content that breaks these terms.</p>

<h2>6. Moderation and appeals</h2>
<p>We use automated checks and human moderators. We may hide content, restrict chat, or suspend accounts. You can appeal most decisions in the app. Decisions are recorded in our audit log.</p>

<h2>7. Groups and rooms</h2>
<p>Group owners and admins manage their groups within these terms. We may remove groups or rooms that break them.</p>

<h2>8. Ending your account</h2>
<p>You can delete your account at any time. We may suspend or terminate accounts that break these terms.</p>

<h2>9. Disclaimers and liability</h2>
<p>The app is provided as is. To the extent the law allows, Pacekin is not liable for losses arising from your use of the app, running activities, events, or dealings with other users.</p>

<h2>10. Governing law</h2>
<p>These terms are governed by the laws of India. Disputes are subject to the courts there.</p>

<h2>11. Changes</h2>
<p>We may update these terms. We will tell you in the app before material changes apply.</p>`;

const DELETE_BODY = `
<h1>Delete your Pacekin account</h1>
<p>This permanently deletes your Pacekin account and personal data: your profile and photos, runs and routes, registrations, friends, group memberships and privacy settings. Your sign-in is removed too. Messages you sent stay in conversations with your name and text removed.</p>
<p class="muted">Moderation records may be kept for up to 180 days where needed for safety and legal reasons. Deletion can't be undone.</p>

<div class="card" id="signedout" hidden>
  <p>Sign in with the Google account you use for Pacekin to confirm it's you.</p>
  <button class="btn" id="signin">Sign in with Google</button>
</div>

<div class="card" id="signedin" hidden>
  <p>Signed in as <b id="email"></b></p>
  <p id="fresh" class="muted"></p>
  <label><input type="checkbox" id="confirm"> I understand this permanently deletes my account and running data.</label><br>
  <button class="btn danger" id="delete" disabled>Delete my account</button>
</div>

<p id="status" role="status"></p>`;

const DELETE_SCRIPT = `
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js"></script>
<script>
const sb = supabase.createClient(${JSON.stringify(Deno.env.get('SUPABASE_URL') ?? '')}, ${JSON.stringify(Deno.env.get('SUPABASE_ANON_KEY') ?? '')});
const $ = id => document.getElementById(id);
let fresh = false;

function sync() {
  $('delete').disabled = !(fresh && $('confirm').checked);
}

async function refresh() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { $('signedout').hidden = false; $('signedin').hidden = true; return; }
  $('signedout').hidden = true;
  $('signedin').hidden = false;
  $('email').textContent = session.user.email || 'your account';
  // Ask for a fresh Google sign-in (within 10 minutes) before deleting.
  const age = Date.now() - new Date(session.user.last_sign_in_at || 0).getTime();
  fresh = age < 10 * 60 * 1000;
  $('fresh').textContent = fresh ? '' : 'For your security, sign in with Google again before deleting.';
  if (!fresh) $('signin').hidden = true;
  sync();
}

$('signin').onclick = () => sb.auth.signInWithOAuth({
  provider: 'google', options: { redirectTo: window.location.href },
});
$('confirm').onchange = sync;
$('delete').onclick = async () => {
  $('delete').disabled = true;
  $('status').textContent = 'Deleting…';
  const { error } = await sb.functions.invoke('delete-account');
  if (error) {
    $('status').textContent = 'Could not delete the account. Please try again, or email ${SUPPORT}.';
    sync();
    return;
  }
  await sb.auth.signOut();
  document.body.innerHTML = '<h1>Account deleted</h1><p>Your Pacekin account and personal data have been deleted. Thank you for running with us.</p>';
};
refresh();
</script>`;

Deno.serve((req) => {
  const page = new URL(req.url).searchParams.get('page') ?? 'home';
  let html: string;
  if (page === 'privacy') html = shell('Privacy policy', PRIVACY);
  else if (page === 'terms') html = shell('Terms and conditions', TERMS);
  else if (page === 'delete') html = shell('Delete account', DELETE_BODY, DELETE_SCRIPT);
  else html = shell('Pacekin', `<h1>Pacekin</h1><p>Find your people. Discover organised runs. Track your progress.</p>
    <p><a class="btn" href="?page=delete">Delete my account</a></p>`);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
});
