import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { requestNotificationPermission, startNotificationListener } from '../lib/push';

type Suspension = { reason: string | null; endsAt: string | null } | null;

type Ctx = {
  session: Session | null;
  profile: any | null;
  loading: boolean;
  suspension: Suspension;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthCtx = createContext<Ctx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspension, setSuspension] = useState<Suspension>(null);

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setSuspension(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    setProfile(data);
    // An active account suspension keeps the runner out of the app, even after signing in.
    const { data: rows } = await supabase.from('account_restrictions')
      .select('reason, ends_at').eq('user_id', user.id).eq('restriction', 'account')
      .order('starts_at', { ascending: false });
    const active = (rows ?? []).find((r: any) => !r.ends_at || new Date(r.ends_at) > new Date());
    setSuspension(active ? { reason: active.reason, endsAt: active.ends_at } : null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await refreshProfile();
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_IN') {
        setLoading(true);
        setSession(s);
        try { await refreshProfile(); } finally { setLoading(false); }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setSuspension(null);
      } else {
        setSession(s);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [refreshProfile]);

  useEffect(() => {
    if (!session?.user.id || suspension) return;
    requestNotificationPermission();
    return startNotificationListener(session.user.id);
  }, [session?.user.id, suspension]);

  // Re-check the account every time the app comes back to the foreground,
  // so a ban applied while someone is using the app takes effect straight away.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) refreshProfile();
      });
    });
    return () => sub.remove();
  }, [refreshProfile]);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthCtx.Provider value={{ session, profile, loading, suspension, refreshProfile, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
