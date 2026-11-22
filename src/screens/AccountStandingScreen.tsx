import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Notice } from '../components/ui';
import { getStanding } from '../services/moderation';
import { colors, radius } from '../lib/config';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function AccountStandingScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setError(null); setData(await getStanding()); }
    catch (e: any) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <Notice text={error} onRetry={load} />;
  if (!data) return <Notice text="Loading…" />;

  const clean = data.strikes.length === 0 && data.restrictions.length === 0 && data.actions.length === 0;
  const activeRestrictions = data.restrictions.filter((r: any) => !r.ends_at || new Date(r.ends_at) > new Date());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {clean ? (
          <View style={s.good}>
            <Text style={s.goodTxt}>Your account is in good standing.</Text>
          </View>
        ) : null}

        {activeRestrictions.length > 0 && (
          <>
            <Text style={s.section}>Current restrictions</Text>
            {activeRestrictions.map((r: any, i: number) => (
              <View key={i} style={s.card}>
                <Text style={s.name}>{r.restriction === 'account' ? 'Account suspended' : `${r.restriction.replace(/_/g, ' ')} restricted`}</Text>
                <Text style={s.meta}>{r.reason ? r.reason.replace(/_/g, ' ') : 'Policy decision'}{r.ends_at ? ` · until ${fmt(r.ends_at)}` : ' · until reviewed'}</Text>
              </View>
            ))}
          </>
        )}

        {data.actions.length > 0 && (
          <>
            <Text style={s.section}>Decisions on your account</Text>
            {data.actions.map((a: any) => {
              const appealed = !!a.appeal;
              return (
                <View key={a.id} style={s.card}>
                  <Text style={s.name}>{a.action.replace(/_/g, ' ')}</Text>
                  <Text style={s.meta}>{fmt(a.created_at)}{a.reason ? ` · ${a.reason.replace(/_/g, ' ')}` : ''}</Text>
                  {appealed ? (
                    <Text style={s.appealTxt}>Appeal {a.appeal.status === 'open' ? 'under review' : a.appeal.status}</Text>
                  ) : (
                    <Pressable onPress={() => navigation.navigate('Appeal', { actionId: a.id, label: a.action.replace(/_/g, ' ') })} style={s.btn}>
                      <Text style={s.btnTxt}>Appeal this decision</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </>
        )}

        {data.strikes.length > 0 && (
          <>
            <Text style={s.section}>Strikes</Text>
            <Text style={s.copy}>Strikes expire after 180 days. Repeated violations can lead to account suspension.</Text>
            {data.strikes.map((k: any, i: number) => (
              <View key={i} style={s.card}>
                <Text style={s.name}>{k.reason.replace(/_/g, ' ')}</Text>
                <Text style={s.meta}>Recorded {fmt(k.created_at)}{k.expires_at ? ` · expires ${fmt(k.expires_at)}` : ''}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  good: { backgroundColor: colors.mint, borderRadius: radius.card, padding: 18, marginBottom: 6 },
  goodTxt: { color: colors.emeraldDeep, fontWeight: '700', fontSize: 15 },
  section: { fontSize: 15, fontWeight: '800', color: colors.forest, marginTop: 18, marginBottom: 10 },
  copy: { color: colors.muted, lineHeight: 20, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
  appealTxt: { marginTop: 10, color: colors.emeraldDeep, fontWeight: '700', fontSize: 13 },
  btn: { marginTop: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.emerald, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  btnTxt: { color: colors.emeraldDeep, fontWeight: '700', fontSize: 13 },
});
