// Brand palette taken from the reference design (forest header, emerald accents, white cards).
export const colors = {
  forest: '#0E3B2E',
  forestDark: '#0A2A21',
  emerald: '#10B981',
  emeraldDeep: '#059669',
  mint: '#D1FAE5',
  white: '#FFFFFF',
  bg: '#F3F6F4',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
};
export const radius = { card: 20, pill: 999, btn: 16 };

// PLACEHOLDER imagery: replace with your licensed running photography before release.
export const IMAGES = {
  welcome: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200',
  banner: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600',
  eventFallback: 'https://images.unsplash.com/photo-1486218119243-13883505764c?w=900',
};

export const CATEGORIES = [
  { key: 'casual', label: 'Casual', icon: 'footsteps' },
  { key: '5k', label: '5K', icon: 'flash' },
  { key: '10k', label: '10K', icon: 'stopwatch' },
  { key: 'half', label: 'Half', icon: 'trophy' },
  { key: 'trail', label: 'Trail', icon: 'leaf' },
] as const;

export const MIN_AGE = 16; // PLACEHOLDER policy: finalise before launch (PRD 5.2 / 31.3)
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com';

// Public web pages served by the "web" edge function.
const WEB_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/web`;
export const LEGAL = {
  privacy: `${WEB_BASE}?page=privacy`,
  terms: `${WEB_BASE}?page=terms`,
  deletion: `${WEB_BASE}?page=delete`,
};

