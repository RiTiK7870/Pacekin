import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import { reportRunner, REPORT_REASONS } from '../services/friends';
import { colors, radius } from '../lib/config';

export default function ReportRunnerScreen({ route, navigation }: any) {
  const { userId, name } = route.params;
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return Alert.alert('Choose a reason', 'Please select why you are reporting this runner.');
    setBusy(true);
    try {
      await reportRunner(userId, reason, details.trim());
      Alert.alert('Thank you', 'Our team will review this report. We keep your identity confidential.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Could not send report', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={s.title}>Report {name}</Text>
        <Text style={s.copy}>Reports are reviewed by Pacekin moderators. False reports can lead to action on your account.</Text>

        <Text style={s.label}>Reason</Text>
        {REPORT_REASONS.map(([key, label]) => (
          <Pressable key={key} onPress={() => setReason(key)} style={[s.option, reason === key && s.optionOn]}>
            <Text style={[s.optionTxt, reason === key && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}

        <Text style={s.label}>Details (optional)</Text>
        <TextInput style={[s.input, { height: 100, textAlignVertical: 'top' }]} multiline value={details}
          onChangeText={setDetails} maxLength={1000} placeholder="What happened?" />

        <PrimaryButton title="Send report" onPress={submit} loading={busy} style={{ marginTop: 22 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: colors.forest },
  copy: { color: colors.muted, marginTop: 6, lineHeight: 20 },
  label: { fontSize: 13, color: colors.muted, marginTop: 18, marginBottom: 8, fontWeight: '700' },
  option: { backgroundColor: '#fff', borderRadius: radius.btn, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  optionOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  optionTxt: { color: colors.text, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderRadius: radius.btn, borderWidth: 1, borderColor: colors.border, padding: 14, fontSize: 15 },
});
