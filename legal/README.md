# Pacekin legal pages

Files: `privacy.html`, `terms.html`, `delete-account.html`. They are plain HTML, so they can be hosted on any static host.

## 1. Fill in the placeholders
Search each file for `[` and `YOUR-` and replace:
- Company name, address, jurisdiction and city (privacy.html, terms.html)
- Minimum age (privacy.html section 10, terms.html section 1). Keep it the same as `MIN_AGE` in `src/lib/config.ts`
- Support email (all three files)
- In delete-account.html: `YOUR-PROJECT-REF` and `YOUR-ANON-KEY`

Have a qualified lawyer review the wording before you publish. These pages are a sound starting point, not legal advice.

## 2. Host the pages
Easiest: Netlify Drop (https://app.netlify.com/drop). Drag the `legal` folder in. You get a URL such as `https://random-name.netlify.app`. Or use GitHub Pages or any web host.

Your three URLs will be:
- `https://YOUR-SITE/privacy.html`
- `https://YOUR-SITE/terms.html`
- `https://YOUR-SITE/delete-account.html`

## 3. Allow the deletion page to sign in
In Supabase, go to Authentication > URL Configuration and add `https://YOUR-SITE/delete-account.html` to Redirect URLs. Google sign-in already goes through your Supabase project, so no new Google setup is needed.

## 4. Point the app at the pages
Put the three URLs in `.env` (see `.env.example`). Then restart with `npx expo start --dev-client --clear`. For store builds, add the same three variables with `eas env:create`, then rebuild.

## 5. Deploy the updated delete function
    supabase functions deploy delete-account
It now also removes profile and chat photos from storage.
