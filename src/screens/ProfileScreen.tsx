import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadAvatar, updateMyProfile } from '../services/profile';
import { colors, radius, SUPPORT_EMAIL, LEGAL } from '../lib/config';

export default function ProfileScreen({ navigation }: any) {
  const { profile, signOut, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const initial = (profile?.full_name ?? '?').trim().charAt(0).toUpperCase() || '?';

  const changePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Photos access', 'Allow photo access to change your profile picture.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(result.assets[0].uri);
      await updateMyProfile({ avatar_url: url });
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Could not update photo', e.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteAccount = () => Alert.alert(
    'Delete account?',
    `This permanently removes your profile, photos, runs, routes and registrations. This cannot be undone. You can also delete your account online at ${LEGAL.deleteAccount}.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.functions.invoke('delete-account');
          if (error) return Alert.alert('Deletion failed', 'Please try again or contact ' + SUPPORT_EMAIL);
          await signOut();
        },
      },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.header}>
          <Pressable onPress={changePhoto} style={s.avatarWrap} accessibilityRole="button" accessibilityLabel="Change profile photo">
            <View style={s.avatar}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: 104, height: 104, borderRadius: 52 }} contentFit="cover" />
              ) : (
                <Text style={s.avatarTxt}>{initial}</Text>
              )}
              {uploading && (
                <View style={s.uploading}><ActivityIndicator color="#fff" /></View>
              )}
            </View>
            <View style={s.camera}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <Text style={s.name}>{profile?.full_name ?? 'Runner'}</Text>
          {!!profile?.username && <Text style={s.handle}>@{profile.username}</Text>}
          <Text style={s.sub}>
            {[profile?.city, profile?.experience_level].filter(Boolean).join(' · ') || 'Complete your profile'}
          </Text>
        </View>

        <View style={{ padding: 20 }}>
          <Item icon="create-outline" label="Edit profile" onPress={() => navigation.navigate('ProfileEdit')} />
          {profile?.role === 'admin' && (
            <Item icon="calendar-outline" label="Manage events" onPress={() => navigation.navigate('AdminEvents')} />
          )}
          {profile?.role === 'admin' && (
            <Item icon="ribbon-outline" label="Manage challenges" onPress={() => navigation.navigate('AdminChallenges')} />
          )}
          <Item icon="people-outline" label="Friends and messages" onPress={() => navigation.navigate('Friends')} />
          <Item icon="lock-closed-outline" label="Privacy and blocking" onPress={() => navigation.navigate('Privacy')} />
          {(profile?.role === 'admin' || profile?.role === 'moderator') && (
            <Item icon="shield-outline" label="Moderation queue" onPress={() => navigation.navigate('ModerationQueue')} />
          )}
          <Item icon="ribbon-outline" label="Account standing" onPress={() => navigation.navigate('AccountStanding')} />
          {profile?.role === 'admin' && (
            <Item icon="stats-chart-outline" label="Admin dashboard" onPress={() => navigation.navigate('AdminDashboard')} />
          )}
          {profile?.role === 'admin' && (
            <Item icon="receipt-outline" label="Audit log" onPress={() => navigation.navigate('AuditLog')} />
          )}
          <Item icon="shield-checkmark-outline" label="Privacy policy" onPress={() => Linking.openURL(LEGAL.privacy)} />
          <Item icon="document-text-outline" label="Terms and conditions" onPress={() => Linking.openURL(LEGAL.terms)} />
          <Item icon="mail-outline" label="Contact support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
          <Item icon="log-out-outline" label="Sign out" onPress={signOut} />
          <Item icon="trash-outline" label="Delete account" danger onPress={deleteAccount} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Item({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={s.item} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.forest} />
      <Text style={[s.itemTxt, danger && { color: colors.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, alignItems: 'center', paddingTop: 24, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  avatarWrap: { width: 104, height: 104 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  avatarTxt: { color: '#fff', fontSize: 38, fontWeight: '800' },
  uploading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  camera: { position: 'absolute', right: 0, bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.forest },
  name: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 12 },
  handle: { color: colors.mint, marginTop: 2 },
  sub: { color: colors.mint, marginTop: 4, fontSize: 13 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 10, gap: 12 },
  itemTxt: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
});
