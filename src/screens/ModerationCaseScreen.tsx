import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Notice, PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import { getCaseDetail, applyCaseAction } from '../services/moderation';
import { colors, radius } from '../lib/config';

const ACTIONS: { key: string; label: string; destructive?: boolean; messageOnly?: boolean }[] = [
  { key: 'dismiss', label: 'Dismiss report' },
  { key: 'warn', label: 'Warn runner' },
  { key: 'hide', label: 'Hide message', messageOnly: true },
  { key: 'remove', label: 'Remove message', destructive: true, messageOnly: true },
  { key: 'restrict_chat', label: 'Restrict chat for 7 days', destructive: true },
  { key: 'suspend', label: 'Suspend account', destructive: true },
  { key: 'escalate', label: 'Escalate to admin' },
  { key: 'restore', label: 'Restore message', messageOnly: true },
];

export default function ModerationCaseScreen({ route, navigation }: any) {
  const { caseId } = route.params;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setError(null); setData(await getCaseDetail(caseId)); }
    catch (e: any) { setError(e.message); }
  }, [caseId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <Notice text={error} onRetry={load} />;
  if (!data) return <Notice text="Loading case…" />;

  const c = data.case;
  const isMessage = c.target_type === 'message';
  const closed = c.status === 'resolved';

  const run = (action: ACTIONS[number]) => {
    const go = async () => {
      setBusy(true);
      try {
        await applyCaseAction(caseId, action.key, c.category);
        Alert.alert('Done', `Action recorded: ${action.label}.`);
        if (action.key !== 'escalate') navigation.goBack();
        else await load();
      } catch (e: any) {
        Alert.alert('Could not apply action', e.message);
      } finally {
        setBusy(false);
      }
    };
    if (action.destructive) {
      Alert.alert(action.label + '?', 'This will be recorded in the audit log and the runner will be notified.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: go },
      ]);
    } else {
      go();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={s.title}>{c.category.replace(/_/g, ' ')}</Text>
        <Text style={s.meta}>
          {c.target_type.replace(/_/g, ' ')} · severity {c.severity} · {c.priority} priority · {c.source} · {c.status}
        </Text>

        <Text style={s.section}>Report</Text>
        <View style={s.card}>
          <Text style={s.copy}>Reason: {data.report?.reason?.replace(/_/g, ' ') ?? c.category}</Text>
          {!!data.report?.details && <Text style={[s.copy, { marginTop: 6 }]}>"{data.report.details}"</Text>}
          <Text style={s.note}>The reporter's identity is kept confidential.</Text>
        </View>

        {isMessage && (
          <>
            <Text style={s.section}>Message content</Text>
            <View style={s.card}>
              {data.evidence.length === 0
                ? <Text style={s.copy}>No copy was captured for this report.</Text>
                : data.evidence.map((e: any, i: number) => (
                    <Text key={i} style={s.copy}>"{e.body_snapshot ?? '[no text]'}"</Text>
                  ))}
            </View>
          </>
        )}

        {data.targetProfile && (
          <>
            <Text style={s.section}>Reported runner</Text>
            <View style={s.card}>
              <Text style={s.copy}>{data.targetProfile.full_name ?? 'Runner'}{data.targetProfile.username ? ` @${data.targetProfile.username}` : ''}</Text>
              <Text style={s.note}>{data.targetProfile.city ?? 'City not set'}</Text>
            </View>
          </>
        )}

        <Text style={s.section}>Decide</Text>
        {closed ? (
          <Text style={s.copy}>This case is resolved.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {ACTIONS.filter(a => !a.messageOnly || isMessage).map(a => (
              <PrimaryButton
                key={a.key}
                title={a.label}
                variant={a.destructive ? 'outline' : 'solid'}
                disabled={busy}
                loading={busy && false}
                onPress={() => run(a)} />
            ))}
          </View>
        )}

        <Text style={s.section}>History</Text>
        {data.actions.length === 0 && <Text style={s.copy}>No actions yet.</Text>}
        {data.actions.map((a: any, i: number) => (
          <Text key={i} style={s.copy}>
            {new Date(a.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {a.action.replace(/_/g, ' ')}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: colors.forest, textTransform: 'capitalize' },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: radius.card, padding: 16 },
  copy: { fontSize: 14, color: colors.text, lineHeight: 20 },
  note: { fontSize: 11, color: colors.muted, marginTop: 8 },
});
