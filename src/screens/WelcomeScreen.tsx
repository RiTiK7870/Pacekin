import { Alert } from '../lib/alert';
import React, { useState } from 'react';
import { ImageBackground, StyleSheet, Text, View, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import Logo from '../components/Logo';
import { signInWithGoogle } from '../lib/auth';
import { IMAGES, colors, SUPPORT_EMAIL, LEGAL } from '../lib/config';

export default function WelcomeScreen() {
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    try { await signInWithGoogle(); }
    catch (e: any) { Alert.alert('Sign-in failed', e.message ?? 'Please try again. Contact ' + SUPPORT_EMAIL); }
    finally { setBusy(false); }
  };
  return (
    <ImageBackground source={require('../../assets/welcome-bg.jpg')} style={{ flex: 1 }}>
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(10,42,33,0.96)']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, justifyContent: 'flex-end', padding: 24 }}>
        <View style={{ alignItems: 'flex-start', marginBottom: 14 }}><Logo size={64} /></View>
        <Text style={s.brand}>PACEKIN</Text>
        <Text style={s.title}>Find Your People.{'\n'}Run Together.</Text>
        <Text style={s.copy}>Discover organized runs, track your progress and build friendships with runners near you.</Text>
        <PrimaryButton title="Get Started" variant="light" onPress={signIn} loading={busy} style={{ marginTop: 28 }} />
        <PrimaryButton title="Sign in with Google" variant="ghost" onPress={signIn} style={{ marginTop: 12 }} />
        <Text style={s.legal}>
          By continuing you agree to our{' '}
          <Text style={s.legalLink} onPress={() => Linking.openURL(LEGAL.terms)}>Terms</Text>
          {' and '}
          <Text style={s.legalLink} onPress={() => Linking.openURL(LEGAL.privacy)}>Privacy Policy</Text>.
        </Text>
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  brand: { color: colors.emerald, fontWeight: '800', letterSpacing: 3, marginBottom: 10 },
  title: { color: '#fff', fontSize: 34, fontWeight: '700', lineHeight: 40 },
  copy: { color: colors.mint, marginTop: 12, fontSize: 15, lineHeight: 22 },
  legal: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 16 },
  legalLink: { color: colors.emerald, fontWeight: '700', textDecorationLine: 'underline' },
});
