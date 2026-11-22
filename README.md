# Pacekin

Community running app built with Expo SDK 58, React Native 0.88, TypeScript and Supabase.
Node 22.13+ (Node 24 also works). Android first; run as a development build, not Expo Go.

## 1. Environment
Create ONE `.env` file in the project root (copy `.env.example`).
Only `EXPO_PUBLIC_*` values reach the app. `OPENROUTER_API_KEY` stays out of the app because the app never reads it.

## 2. Install
    npm install
    npx expo install --fix
    npx expo install @react-native-community/datetimepicker

## 3. Supabase (once per project)
    npx supabase login
    npx supabase link --project-ref YOUR_PROJECT_REF
    # Run supabase/migrations or pacekin_full_schema.sql in the SQL editor first.
    $key = (Select-String -Path .env -Pattern '^OPENROUTER_API_KEY=(.*)$').Matches.Groups[1].Value
    npx supabase secrets set "OPENROUTER_API_KEY=$key"
    npx supabase functions deploy ai-coach
    npx supabase functions deploy delete-account

Redirect URL to allow in Supabase Auth: `pacekin://auth-callback`.
Make your owner account admin once, in the SQL editor:
    update public.profiles set role = 'admin' where id = '<owner-uuid>';

## 4. Build and run (development build)
    npx expo prebuild --platform android --clean
    npx expo run:android
    npx expo start --dev-client --clear

Rebuild with `prebuild` and `run:android` after changing native packages, app.json or the app icon.

## 5. Status
Implemented: Google sign-in, profile setup with date picker, Home, Explore, event join/leave, GPS run recording, Activity history, AI Coach (server-side OpenRouter), profile and account deletion.
Roadmap: background GPS, offline sync, route map, community chat UI, groups UI, friends, admin console, notifications.

## Placeholders before launch
- `src/lib/config.ts`: banner and welcome image URLs, minimum age, support email.
- `src/screens/ProfileScreen.tsx`: privacy policy and terms URLs.
