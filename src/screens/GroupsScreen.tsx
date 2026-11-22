import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Notice, PrimaryButton } from '../components/ui';
import { discoverGroups, myGroups } from '../services/groups';
import { colors, radius } from '../lib/config';

export default function GroupsScreen({ navigation }: any) {
  const [mine, setMine] = useState<any[]>([]);
  const [found, setFound] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [m, d] = await Promise.all([myGroups(), discoverGroups(search)]);
      setMine(m);
      setFound(d.filter((g: any) => !m.some((x: any) => x.id === g.id)));
    } catch (e: any) {
      setError(e.message);
    }
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (g: any) => navigation.navigate('GroupDetail', { groupId: g.id });

  const GroupCard = ({ g }: { g: any }) => (
    <Pressable onPress={() => open(g)} style={s.card}>
      <View style={s.icon}><Ionicons name="people" size={20} color="#fff" /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{g.name}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {[g.city, g.running_level, g.visibility === 'private' ? 'Private' : 'Public'].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {g.myRole && <Text style={s.role}>{g.myRole === 'owner' ? 'OWNER' : g.myRole === 'admin' ? 'ADMIN' : 'MEMBER'}</Text>}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Running groups</Text>
        <PrimaryButton title="Create a group" variant="light" onPress={() => navigation.navigate('CreateGroup')} style={{ marginTop: 12, height: 46 }} />
      </View>

      {error ? <Notice text={error} onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={s.section}>My groups</Text>
          {mine.length === 0
            ? <Text style={s.copy}>You are not in any group yet.</Text>
            : mine.map(g => <GroupCard key={g.id} g={g} />)}

          <Text style={s.section}>Discover public groups</Text>
          <View style={s.searchBox}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or city"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              onSubmitEditing={load}
            />
          </View>
          {found.length === 0
            ? <Text style={s.copy}>No other public groups match. Try a different search or create one.</Text>
            : found.map(g => <GroupCard key={g.id} g={g} />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.forest, padding: 20, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 8, marginBottom: 10 },
  copy: { color: colors.muted, lineHeight: 20, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginBottom: 10, gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  role: { fontSize: 10, fontWeight: '800', color: colors.emeraldDeep },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, height: 46, gap: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
});
