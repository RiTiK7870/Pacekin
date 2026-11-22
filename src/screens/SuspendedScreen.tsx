import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { Alert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { SUPPORT_EMAIL, colors, radius } from '../lib/config';

// Shown instead of the whole app when the account is banned. The only actions are
// signing out or deleting the account and its data.
export default function SuspendedScreen() {
  const { suspension, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const until = suspension?.endsAt
    ? new Date(suspension.endsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const deleteData = () => Alert.alert(
    'Delete your data?',
    'This permanently deletes your account, profile, photos and running data. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const { error } = await supabase.functions.invoke('delete-account');
          if (error) {
            setBusy(false);
            return Alert.alert('Deletion failed', `Please try again, or contact ${SUPPORT_EMAIL}.`);
          }
          await signOut();
        },
      },
    ]);

  return (
    <SafeAreaView style={s.wrap} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, flexGrow: 1 }}>
        <View style={s.badge}>
          <Text style={s.badgeTxt}>ACCOUNT BANNED</Text>
        </View>
        <Text style={s.title}>Your account has been banned</Text>
        <Text style={s.copy}>
          You can no longer use Pacekin with this account.
        </Text>
        {!!suspension?.reason && <Text style={s.detail}>Reason: {suspension.reason.replace(/_/g, ' ')}</Text>}
        {until && <Text style={s.detail}>Restricted until {until}</Text>}
        <Text style={s.help}>
          If you think this is a mistake, email {SUPPORT_EMAIL}.
        </Text>

        <View style={{ flex: 1 }} />

        <View style={s.actions}>
          <PrimaryButton title="Sign out" variant="light" onPress={signOut} disabled={busy} />
          <PrimaryButton title="Delete my account and data" variant="ghost" onPress={deleteData} loading={busy} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.forest },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, marginTop: 24 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 16 },
  copy: { color: colors.mint, marginTop: 12, lineHeight: 22, fontSize: 15 },
  detail: { color: '#fff', marginTop: 12, fontSize: 14, fontWeight: '600' },
  help: { color: colors.mint, marginTop: 20, lineHeight: 20, fontSize: 13 },
  actions: { gap: 12, marginTop: 24 },
});
