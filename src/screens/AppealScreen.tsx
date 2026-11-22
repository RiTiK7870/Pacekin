import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import { submitAppeal } from '../services/moderation';
import { colors, radius } from '../lib/config';

export default function AppealScreen({ route, navigation }: any) {
  const { actionId, label } = route.params;
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (statement.trim().length < 10) return Alert.alert('Add more detail', 'Please explain your side in at least 10 characters.');
    setBusy(true);
    try {
      await submitAppeal(actionId, statement.trim());
      Alert.alert('Appeal sent', 'A moderator will review your appeal. You will be notified of the outcome.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Could not send appeal', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={s.title}>Appeal: {label}</Text>
        <Text style={s.copy}>Explain why you believe this decision was wrong or what context was missing. Appeals are reviewed by a different moderator where possible.</Text>
        <TextInput style={s.input} multiline value={statement} onChangeText={setStatement}
          placeholder="Your explanation" maxLength={1000} />
        <Text style={s.count}>{statement.length}/1000</Text>
        <PrimaryButton title="Send appeal" onPress={send} loading={busy} style={{ marginTop: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.forest, textTransform: 'capitalize' },
  copy: { color: colors.muted, marginTop: 8, lineHeight: 20 },
  input: { backgroundColor: '#fff', borderRadius: radius.btn, borderWidth: 1, borderColor: colors.border, padding: 14, fontSize: 15, minHeight: 140, textAlignVertical: 'top', marginTop: 16 },
  count: { fontSize: 11, color: colors.muted, textAlign: 'right', marginTop: 4 },
});
