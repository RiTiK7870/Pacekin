import { Alert } from '../lib/alert';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CategoryIcon, EventCard, Notice, PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { listEvents } from '../services/events';
import { fetchStats } from '../services/runs';
import { unreadCount } from '../services/notifications';
import { CATEGORIES, colors, IMAGES, radius } from '../lib/config';

export default function HomeScreen({ navigation }: any) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState({ km: 0, runs: 0, streak: 0 });
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [featured, setFeatured] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [ev, st] = await Promise.all([listEvents({}), fetchStats()]);
      setEvents(ev.slice(0, 5));
      setFeatured(ev.filter((e: any) => e.featured).slice(0, 3));
      setStats(st);
      setUnread(await unreadCount().catch(() => 0));
    } catch (e: any) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={s.header}>
        <View style={{ paddingTop: insets.top }}>
          <View style={s.topRow}>
            <View>
              <Text style={s.sub}>Hello,</Text>
              <Text style={s.name}>{profile?.full_name?.split(' ')[0]}</Text>
              <View style={s.locRow}>
                <Ionicons name="location" size={14} color={colors.mint} />
                <Text style={s.sub}>{profile?.city}</Text>
              </View>
            </View>
            <Pressable style={s.bell} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {unread > 0 && <View style={s.dot} />}
            </Pressable>
          </View>
          <Pressable onPress={() => navigation.navigate('Explore')} style={s.search}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <Text style={{ color: colors.muted, marginLeft: 10, flex: 1 }}>Search events, cities or distances</Text>
            <Ionicons name="options-outline" size={20} color={colors.muted} />
          </Pressable>
          <View style={s.catRow}>
            {CATEGORIES.map(c => (
              <CategoryIcon key={c.key} label={c.label} icon={c.icon}
                onPress={() => navigation.navigate('Explore', { category: c.key })} />
            ))}
          </View>
        </View>
      </View>

      <View style={s.body}>
        <View style={s.banner}>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>Join your next run today!</Text>
            <PrimaryButton title="Find Events" variant="light" onPress={() => navigation.navigate('Explore')}
              style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 20, marginTop: 14 }} />
          </View>
          <Image source={{ uri: IMAGES.banner }} style={s.bannerImg} contentFit="cover" />
        </View>

        <View style={s.statsRow}>
          <Stat label="Total km" value={String(stats.km)} />
          <Stat label="Streak" value={`${stats.streak}d`} />
          <Stat label="Runs" value={String(stats.runs)} />
        </View>

        <PrimaryButton title="Start GPS run" onPress={() => navigation.navigate('RunTracker')} style={{ marginBottom: 8 }} />
        <PrimaryButton title="Ask AI Coach" variant="outline" onPress={() => navigation.navigate('AICoach')} />

        {featured.length > 0 && (
          <>
            <View style={s.sectionHead}><Text style={s.section}>Featured</Text></View>
            {featured.map(f => (
              <EventCard key={f.id} event={f} onPress={() => navigation.navigate('EventDetail', { eventId: f.id })} />
            ))}
          </>
        )}
        <View style={s.sectionHead}>
          <Text style={s.section}>Upcoming events</Text>
          <Pressable onPress={() => navigation.navigate('Explore')}><Text style={{ color: colors.emeraldDeep }}>View all</Text></Pressable>
        </View>

        {error ? <Notice text={`Could not load events. ${error}`} onRetry={load} />
          : events.length === 0 ? <Notice text="No upcoming official events yet. Check back soon." />
          : events.map(ev => <EventCard key={ev.id} event={ev} onPress={() => navigation.navigate('EventDetail', { eventId: ev.id })} />)}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  sub: { color: colors.mint, fontSize: 13 },
  name: { color: '#fff', fontSize: 24, fontWeight: '700' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: '#F87171' },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.pill, marginHorizontal: 20, marginTop: 18, paddingHorizontal: 16, height: 52 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: 18 },
  body: { padding: 20 },
  banner: { backgroundColor: colors.emeraldDeep, borderRadius: radius.card, padding: 20, flexDirection: 'row', overflow: 'hidden', minHeight: 130, marginBottom: 18 },
  bannerTitle: { color: '#fff', fontSize: 22, fontWeight: '700', width: '70%' },
  bannerImg: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 140, opacity: 0.9 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: radius.card, padding: 14, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800', color: colors.forest },
  statLbl: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  section: { fontSize: 18, fontWeight: '700', color: colors.text },
});
