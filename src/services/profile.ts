import { supabase } from '../lib/supabase';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

// Stores the photo in the user's own folder of the avatars bucket (existing storage policy: <user_id>/...).
export async function uploadAvatar(localUri: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const bytes = await (await fetch(localUri)).arrayBuffer();
  const path = `${user.id}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function updateMyProfile(values: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('profiles').update(values).eq('id', user.id);
  if (error) {
    if (error.code === '23505') throw new Error('That username is already taken. Try another.');
    throw error;
  }
}
