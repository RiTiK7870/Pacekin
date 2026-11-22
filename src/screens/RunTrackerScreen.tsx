import { Alert } from '../lib/alert';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { acceptPoint, downsample, formatDuration, formatKm, formatPace, haversine, Pt } from '../lib/geo';
import { saveRun } from '../services/runs';
import { colors } from '../lib/config';

type Phase = 'idle' | 'running' | 'paused' | 'saving';

export default function RunTrackerScreen({ navigation }: any) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [dist, setDist] = useState(0);
  const [secs, setSecs] = useState(0);

  const phaseRef = useRef<Phase>('idle');
  const pts = useRef<Pt[]>([]);
  const distRef = useRef(0);
  const skipNext = useRef(false);            // after a pause, don't count the gap as distance
  const startedAt = useRef<Date | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const startTimer = () => { timer.current = setInterval(() => setSecs(s => s + 1), 1000); };
  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const stopWatch = () => { sub.current?.remove(); sub.current = null; };

  // Release GPS and timers if the screen unmounts mid-run.
  useEffect(() => () => { stopTimer(); stopWatch(); }, []);

  const start = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Pacekin uses your location only while you record a run.');
      return;
    }
    pts.current = []; distRef.current = 0; skipNext.current = false;
    setDist(0); setSecs(0); startedAt.current = new Date();
    sub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, timeInterval: 2000 },
      loc => {
        if (phaseRef.current !== 'running') return;
        const p: Pt = { lat: loc.coords.latitude, lng: loc.coords.longitude, t: loc.timestamp, acc: loc.coords.accuracy ?? 999 };
        const prev = pts.current[pts.current.length - 1];
        if (!acceptPoint(prev, p)) return;           // noisy fix or implausible jump
        if (prev && !skipNext.current) distRef.current += haversine(prev, p);
        skipNext.current = false;
        pts.current.push(p);
        setDist(distRef.current);
      });
    setP('running'); startTimer();
  };

  const pause = () => { setP('paused'); stopTimer(); };
  const resume = () => { skipNext.current = true; setP('running'); startTimer(); };

  const finish = async () => {
    stopTimer(); stopWatch(); setP('saving');
    const meters = Math.round(distRef.current);
    const duration = secs;
    if (meters < 50 || pts.current.length < 2) {
      Alert.alert('Run too short', 'Runs under 50 m are not saved.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      return;
    }
    try {
      await saveRun({ startedAt: startedAt.current!, endedAt: new Date(), distanceM: meters, durationS: duration, points: downsample(pts.current) });
      Alert.alert('Run saved', `${formatKm(meters)} km · ${formatDuration(duration)} · ${formatPace(meters, duration)} /km`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Saved locally only', 'We could not reach the server. Your run will be retried in a future release.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    }
  };

  const kcal = Math.round((distRef.current / 1000) * 70); // rough estimate, assumes 70 kg

  return (
    <SafeAreaView style={s.wrap}>
      <Text style={s.label}>{phase === 'idle' ? 'Ready when you are' : phase === 'paused' ? 'Paused' : phase === 'saving' ? 'Saving…' : 'Recording'}</Text>
      <Text style={s.big}>{formatKm(dist)}<Text style={s.unit}> km</Text></Text>
      <View style={s.stats}>
        <Stat label="Time" value={formatDuration(secs)} />
        <Stat label="Avg pace" value={`${formatPace(dist, secs)}`} />
        <Stat label="Est. kcal" value={String(kcal)} />
      </View>
      <Text style={s.note}>GPS route is recorded only while the run is active. Screen-locked tracking needs the Android build.</Text>

      <View style={s.controls}>
        {phase === 'idle' && <PrimaryButton title="Start run" variant="light" onPress={start} style={{ flex: 1 }} />}
        {phase === 'running' && <>
          <PrimaryButton title="Pause" variant="ghost" onPress={pause} style={{ flex: 1 }} />
          <PrimaryButton title="Finish" variant="light" onPress={finish} style={{ flex: 1 }} /></>}
        {phase === 'paused' && <>
          <PrimaryButton title="Resume" variant="light" onPress={resume} style={{ flex: 1 }} />
          <PrimaryButton title="Finish" variant="ghost" onPress={finish} style={{ flex: 1 }} /></>}
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: colors.mint, fontSize: 12, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.forest, padding: 24, justifyContent: 'center' },
  label: { color: colors.mint, textAlign: 'center', fontSize: 14, letterSpacing: 1 },
  big: { color: '#fff', fontSize: 72, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  unit: { fontSize: 24, color: colors.mint },
  stats: { flexDirection: 'row', marginTop: 32 },
  note: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 24 },
  controls: { flexDirection: 'row', gap: 12, marginTop: 40 },
});
