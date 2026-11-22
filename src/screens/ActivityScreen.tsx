import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { PrimaryButton, Notice } from '../components/ui';
import { listRuns } from '../services/runs';
import { formatDuration, formatKm, formatPace } from '../lib/geo';
import { colors, radius } from '../lib/config';

export default function ActivityScreen({ navigation }: any) {
  const [runs, setRuns] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    listRuns().then(r => { setRuns(r); setError(null); }).catch(e => setError(e.message));
  }, []));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Activity</Text>
        <PrimaryButton title="Start GPS run" variant="light" onPress={() => navigation.navigate('RunTracker')} style={{ marginTop: 12 }} />
        <PrimaryButton title="AI Coach" variant="ghost" onPress={() => navigation.navigate('AICoach')} style={{ marginTop: 10 }} />
        <PrimaryButton title="Leaderboard" variant="ghost" onPress={() => navigation.navigate('Leaderboard')} style={{ marginTop: 10 }} />
        <PrimaryButton title="Achievements" variant="ghost" onPress={() => navigation.navigate('Achievements')} style={{ marginTop: 10 }} />
        <PrimaryButton title="Challenges" variant="ghost" onPress={() => navigation.navigate('Challenges')} style={{ marginTop: 10 }} />
        <PrimaryButton title="Running groups" variant="ghost" onPress={() => navigation.navigate('Groups')} style={{ marginTop: 10 }} />
        <PrimaryButton title="Community rooms" variant="ghost" onPress={() => navigation.navigate('CommunityRooms')} style={{ marginTop: 10 }} />
      </View>
      {error ? <Notice text={error} /> : (
        <FlatList
          data={runs}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={<Notice text="No runs yet. Start your first GPS run." />}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.date}>{new Date(item.started_at).toLocaleDateString()}</Text>
                <Text style={s.meta}>{formatDuration(item.duration_s)} · {formatPace(item.distance_m, item.duration_s)} /km</Text>
              </View>
              <Text style={s.km}>{formatKm(item.distance_m)} km</Text>
              <Text style={[s.badge, item.verified ? { color: colors.emeraldDeep } : { color: colors.muted }]}>
                {item.verified ? 'GPS' : 'Manual'}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 16, marginBottom: 12 },
  date: { fontWeight: '700', color: colors.text },
  meta: { color: colors.muted, marginTop: 4, fontSize: 13 },
  km: { fontWeight: '800', color: colors.forest, marginRight: 12 },
  badge: { fontSize: 12, fontWeight: '700' },
});
