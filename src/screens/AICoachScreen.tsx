import { Alert } from '../lib/alert';
import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../lib/config';

const STARTERS = ['Build me a 5K plan', 'Summarize my week', 'Help me improve my consistency', 'Find an upcoming 10K event'];
type Msg = { role: 'user' | 'ai'; text: string };

export default function AICoachScreen() {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'ai', text: 'Hi, I am the Pacekin AI Coach. My suggestions are general and not medical advice. Ask me anything about your running.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    supabase.from('ai_preferences').select('enabled, personalization_consent').maybeSingle()
      .then(({ data }) => { if (data) { setEnabled(data.enabled); setConsent(data.personalization_consent); } });
  }, []);

  const savePrefs = async (next: { enabled?: boolean; personalization_consent?: boolean }) => {
    const merged = { enabled, personalization_consent: consent, ...next };
    setEnabled(merged.enabled); setConsent(merged.personalization_consent);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('ai_preferences').upsert({ user_id: user!.id, ...merged, updated_at: new Date().toISOString() });
  };

  const onToggleConsent = (v: boolean) => {
    if (!v) return savePrefs({ personalization_consent: false });
    Alert.alert('Use my running data?',
      'Aggregate totals from your verified GPS runs (distance, time) are sent to our AI provider to personalise replies. Routes and location are never sent. You can turn this off any time.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Allow', onPress: () => savePrefs({ personalization_consent: true }) }]);
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setMsgs(m => [...m, { role: 'user', text: t }]);
    setInput(''); setBusy(true);
    const { data, error } = await supabase.functions.invoke('ai-coach', { body: { message: t } });
    setBusy(false);
    let detail: string | undefined = data?.error;
    if (error && !detail) {
      try {
        const text = await (error as any).context.text();
        detail = JSON.parse(text)?.error ?? text;
      } catch {
        // no readable body
      }
    }
    const reply = data?.reply
      ? data.reply
      : `Coach unavailable: ${detail ?? error?.message ?? 'unknown error'}`;
    setMsgs(m => [...m, { role: 'ai', text: reply }]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.prefs}>
          <Text style={{ flex: 1, color: colors.text }}>Use my running data for personalised tips</Text>
          <Switch value={consent} onValueChange={onToggleConsent} disabled={!enabled} />
        </View>
        {!enabled && (
          <Pressable style={s.enable} onPress={() => savePrefs({ enabled: true })}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Turn on AI Coach</Text>
          </Pressable>
        )}
        <FlatList
          data={msgs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={[s.bubble, item.role === 'user' ? s.me : s.ai]}>
              <Text style={{ color: item.role === 'user' ? '#fff' : colors.text, lineHeight: 20 }}>{item.text}</Text>
            </View>
          )}
        />
        {msgs.length === 1 && (
          <View style={s.starters}>
            {STARTERS.map(p => (
              <Pressable key={p} style={s.starter} onPress={() => send(p)}>
                <Text style={{ color: colors.forest, fontWeight: '600' }}>{p}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={s.inputRow}>
          <TextInput style={s.input} value={input} onChangeText={setInput} placeholder="Ask your coach…" maxLength={1000} editable={enabled} />
          <Pressable style={s.send} onPress={() => send(input)} disabled={!enabled || busy}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? '…' : 'Send'}</Text>
          </Pressable>
        </View>
        <Text style={s.disclaimer}>AI-generated suggestions. Not medical advice. For pain or injury, see a qualified professional.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  prefs: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.border },
  enable: { margin: 16, backgroundColor: colors.emeraldDeep, padding: 14, borderRadius: radius.btn, alignItems: 'center' },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 16, marginBottom: 10 },
  me: { alignSelf: 'flex-end', backgroundColor: colors.forest },
  ai: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  starter: { backgroundColor: colors.mint, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff' },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 16, height: 46 },
  send: { backgroundColor: colors.forest, borderRadius: radius.pill, paddingHorizontal: 18, justifyContent: 'center' },
  disclaimer: { fontSize: 11, color: colors.muted, textAlign: 'center', padding: 8 },
});
