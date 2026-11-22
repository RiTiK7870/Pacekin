import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, Notice, EventCover } from '../components/ui';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import { fetchEvent, myRegistration, joinEvent, leaveEvent, applyPaidEvent, RegStatus } from '../services/events';
import {
  ageOf, listRegistrants, listApplications, setCheckIn, reviewApplication, setPaymentStatus,
} from '../services/adminEvents';
import { colors, radius } from '../lib/config';

type EventState = 'cancelled' | 'completed' | 'live' | 'closed' | 'full' | 'open';
type Filter = 'all' | 'in' | 'out';

const ordinal = (n: number) => ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`;
const inr = (n: number | string) => `₹${Number(n).toLocaleString('en-IN')}`;

export default function EventDetailScreen({ route, navigation }: any) {
  const { eventId } = route.params;
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [ev, setEv] = useState<any>(null);
  const [reg, setReg] = useState<RegStatus | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      setEv(await fetchEvent(eventId));
      if (isAdmin) {
        setRoster(await listRegistrants(eventId));
        setApps(await listApplications(eventId));
      } else {
        setReg(await myRegistration(eventId));
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [eventId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (error) return <Notice text={error} onRetry={load} />;
  if (!ev) return <Notice text="Loading event…" />;

  const paid = !!ev.is_paid;
  const startMs = new Date(ev.starts_at).getTime();
  const endMs = ev.ends_at ? new Date(ev.ends_at).getTime() : startMs + 2 * 3600e3;
  const closeMs = new Date(ev.reg_closes_at ?? ev.starts_at).getTime();
  const full = ev.registered_count >= ev.capacity;

  const state: EventState =
    ev.status === 'cancelled' ? 'cancelled'
    : now >= endMs ? 'completed'
    : now >= startMs ? 'live'
    : now >= closeMs ? 'closed'
    : full ? 'full'
    : 'open';

  const STATE_LABEL: Record<EventState, string> = {
    cancelled: 'Cancelled',
    completed: 'Completed',
    live: 'Live now',
    closed: 'Registration closed',
    full: ev.waitlist_enabled ? 'Full · waitlist open' : 'Full',
    open: paid ? 'Applications open' : 'Registration open',
  };
  const STATE_COLOR: Record<EventState, string> = {
    cancelled: colors.danger,
    completed: colors.muted,
    live: colors.emeraldDeep,
    closed: '#B45309',
    full: '#B45309',
    open: colors.emeraldDeep,
  };

  const canChange = state === 'open' || state === 'full';
  const seatAvailable = state === 'open' || (state === 'full' && !!ev.waitlist_enabled);
  const canApply = paid && !reg && state === 'open';
  const canJoinFree = !paid && !reg && seatAvailable;
  const canConfirmPaid = paid && reg === 'approved' && seatAvailable;

  const onPrimary = async () => {
    setBusy(true);
    try {
      if (canApply) {
        await applyPaidEvent(eventId);
        Alert.alert('Application sent', 'The organiser will review it. You will get a notification when it is approved.');
      } else if (reg === 'confirmed' || reg === 'waitlisted') {
        await leaveEvent(eventId);
        Alert.alert(reg === 'waitlisted' ? 'Removed from waitlist' : 'You have left the event');
      } else {
        const result = await joinEvent(eventId);
        if (result === 'waitlisted') {
          Alert.alert("You're on the waitlist", "If a spot opens up, you'll be moved into the event and notified.");
        } else {
          Alert.alert("You're in!", 'We will send your confirmation and reminders.');
        }
      }
      await load();
    } catch (e: any) {
      Alert.alert('Could not update registration', e.message);
    } finally {
      setBusy(false);
    }
  };

  let buttonTitle = STATE_LABEL[state];
  let buttonDisabled = true;
  let buttonVariant: 'solid' | 'outline' = 'solid';
  if (reg === 'confirmed') {
    buttonTitle = canChange ? 'Leave event' : 'You are going';
    buttonDisabled = !canChange;
    buttonVariant = 'outline';
  } else if (reg === 'waitlisted') {
    buttonTitle = canChange ? 'Leave waitlist' : 'On waitlist';
    buttonDisabled = !canChange;
    buttonVariant = 'outline';
  } else if (reg === 'pending_review') {
    buttonTitle = 'Under review';
  } else if (reg === 'rejected') {
    buttonTitle = 'Not approved';
  } else if (reg === 'approved') {
    buttonTitle = `Confirm & join · ${inr(ev.entry_fee)}`;
    buttonDisabled = !canConfirmPaid;
  } else if (paid) {
    buttonTitle = 'Apply to join';
    buttonDisabled = !canApply;
  } else if (canJoinFree) {
    buttonTitle = state === 'full' ? 'Join waitlist' : 'Join event';
    buttonDisabled = false;
  }

  const bottomText =
    reg === 'confirmed' ? 'You are going'
    : reg === 'waitlisted' ? 'You are on the waitlist'
    : reg === 'pending_review' ? 'Application under review'
    : reg === 'approved' ? 'Approved · confirm to take your spot'
    : reg === 'rejected' ? 'Application not approved'
    : STATE_LABEL[state];

  const checkedInCount = roster.filter(r => r.checkedIn).length;
  const q = search.trim().toLowerCase();
  const filteredRoster = roster.filter(r => {
    if (filter === 'in' && !r.checkedIn) return false;
    if (filter === 'out' && r.checkedIn) return false;
    if (!q) return true;
    return [r.full_name, r.username, r.city].some(v => String(v ?? '').toLowerCase().includes(q));
  });

  const toggleCheckIn = async (r: any) => {
    try {
      await setCheckIn(eventId, r.userId, !r.checkedIn);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update check-in', e.message);
    }
  };

  const decide = async (userId: string, approve: boolean) => {
    try {
      await reviewApplication(eventId, userId, approve);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update application', e.message);
    }
  };

  const togglePaid = async (a: any) => {
    try {
      await setPaymentStatus(eventId, a.userId, a.paymentStatus !== 'paid');
      await load();
    } catch (e: any) {
      Alert.alert('Could not update payment', e.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        <EventCover uri={ev.cover_url} height={260} />
        <View style={s.body}>
          <View style={[s.pill, { backgroundColor: STATE_COLOR[state] }]}>
            <Text style={s.pillTxt}>{STATE_LABEL[state].toUpperCase()}</Text>
          </View>
          {paid && (
            <View style={[s.pill, { backgroundColor: colors.forest, marginLeft: 8 }]}>
              <Text style={s.pillTxt}>PAID · {inr(ev.entry_fee)}</Text>
            </View>
          )}
          <Text style={s.title}>{ev.title}</Text>
          <Row icon="location" text={`${ev.meeting_point ?? ''}${ev.city ? ` · ${ev.city}` : ''}`} />
          <Row icon="calendar" text={new Date(ev.starts_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          <Row icon="people" text={`${Math.max(ev.capacity - ev.registered_count, 0)} of ${ev.capacity} spots left`} />

          <Text style={s.section}>About this run</Text>
          <Text style={s.copy}>{ev.description ?? 'Details will be shared by the Pacekin team.'}</Text>

          {paid && (
            <>
              <Text style={s.section}>Entry and prizes</Text>
              <Text style={s.copy}>Entry fee: {inr(ev.entry_fee)}. Apply first; the organiser reviews every application.</Text>
              {(ev.prizes ?? []).length > 0 && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  {(ev.prizes as any[]).map(p => (
                    <View key={p.place} style={s.prizeRow}>
                      <Text style={s.prizePlace}>{ordinal(p.place)}</Text>
                      <Text style={s.prizeTxt}>
                        {p.type === 'cash' ? `${inr(p.amount)} cash` : p.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {ev.facilities?.length > 0 && (
            <>
              <Text style={s.section}>Facilities</Text>
              <View style={s.grid}>
                {ev.facilities.map((f: string) => (
                  <View key={f} style={s.facility}>
                    <Ionicons name="checkmark" size={16} color={colors.emeraldDeep} />
                    <Text style={{ marginLeft: 6, color: colors.text }}>{f}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {isAdmin ? (
            <>
              {paid && (
                <>
                  <Text style={s.section}>Applications ({apps.length})</Text>
                  {apps.length === 0 ? (
                    <Text style={s.copy}>No applications yet.</Text>
                  ) : apps.map(a => (
                    <RunnerCard key={a.userId} r={a} label="Applied" showStatus>
                      {a.status === 'pending_review' ? (
                        <View style={s.actionRow}>
                          <Pressable onPress={() => decide(a.userId, true)} style={[s.actionBtn, s.actionOk]}>
                            <Text style={[s.actionTxt, { color: '#fff' }]}>Approve</Text>
                          </Pressable>
                          <Pressable onPress={() => decide(a.userId, false)} style={s.actionBtn}>
                            <Text style={[s.actionTxt, { color: colors.danger }]}>Reject</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={s.actionRow}>
                          <Pressable onPress={() => togglePaid(a)} style={[s.actionBtn, a.paymentStatus === 'paid' && s.actionOk]}>
                            <Text style={[s.actionTxt, a.paymentStatus === 'paid' && { color: '#fff' }]}>
                              {a.paymentStatus === 'paid' ? 'Paid ✓' : 'Mark as paid'}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </RunnerCard>
                  ))}
                </>
              )}

              <Text style={s.section}>Registered runners ({checkedInCount}/{roster.length} checked in)</Text>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color={colors.muted} />
                <TextInput
                  style={s.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search name, username or city"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                />
                {!!search && (
                  <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                  </Pressable>
                )}
              </View>
              <View style={s.filters}>
                {([['all', 'All'], ['in', 'Checked in'], ['out', 'Not checked in']] as [Filter, string][]).map(([key, label]) => (
                  <Pressable key={key} onPress={() => setFilter(key)} style={[s.filterPill, filter === key && s.filterOn]}>
                    <Text style={[s.filterTxt, filter === key && { color: '#fff' }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {roster.length === 0 ? (
                <Text style={s.copy}>No one has joined yet.</Text>
              ) : filteredRoster.length === 0 ? (
                <Text style={s.copy}>No runners match your search.</Text>
              ) : (
                filteredRoster.map(r => (
                  <RunnerCard key={r.userId} r={r} label="Joined">
                    <Pressable onPress={() => toggleCheckIn(r)} style={[s.checkBtn, r.checkedIn && s.checkBtnOn]} accessibilityRole="button">
                      <Text style={[s.checkTxt, r.checkedIn && { color: '#fff' }]}>{r.checkedIn ? 'Checked in' : 'Check in'}</Text>
                    </Pressable>
                  </RunnerCard>
                ))
              )}
              <Text style={s.note}>Runner details are visible only to event organisers, to help identify runners at the start.</Text>
            </>
          ) : (
            <Text style={s.note}>Official event managed by Pacekin. AI and community members cannot create or change events.</Text>
          )}
        </View>
      </ScrollView>

      <View style={s.bottom}>
        {isAdmin ? (
          <>
            <View>
              <Text style={s.price}>Organiser</Text>
              <Text style={s.meta}>{checkedInCount} checked in</Text>
            </View>
            <PrimaryButton title="Edit event" variant="outline" onPress={() => navigation.navigate('AdminEventForm', { eventId })} style={{ flex: 1, marginLeft: 16 }} />
          </>
        ) : (
          <>
            <View style={{ flexShrink: 1 }}>
              <Text style={s.price}>{paid ? inr(ev.entry_fee) : ev.distance_km ? `${ev.distance_km} km` : ev.category}</Text>
              <Text style={s.meta} numberOfLines={1}>{bottomText}</Text>
            </View>
            <PrimaryButton
              title={buttonTitle}
              variant={buttonVariant}
              onPress={onPrimary}
              loading={busy}
              disabled={buttonDisabled}
              style={{ flex: 1, marginLeft: 16 }} />
          </>
        )}
      </View>
    </View>
  );
}

function RunnerCard({ r, label, showStatus, children }: { r: any; label: string; showStatus?: boolean; children?: React.ReactNode }) {
  const initial = (r.full_name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const age = ageOf(r.date_of_birth);
  return (
    <View style={s.runner}>
      <View style={s.runnerTop}>
        <View style={s.avatar}>
          {r.avatar_url
            ? <Image source={{ uri: r.avatar_url }} style={{ width: 46, height: 46, borderRadius: 23 }} contentFit="cover" />
            : <Text style={s.avatarTxt}>{initial}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.runnerName} numberOfLines={1}>
            {r.full_name ?? 'Runner'}{r.username ? `  @${r.username}` : ''}
          </Text>
          <Text style={s.runnerMeta}>
            {age !== null ? `${age} yrs` : 'Age not set'} · {r.gender ?? 'Gender not set'} · {r.city ?? 'City not set'}
          </Text>
          <Text style={s.runnerMeta}>
            {r.experience_level ?? 'Level not set'} · prefers {r.preferred_distance ?? 'any distance'}
          </Text>
          <Text style={s.runnerMeta}>
            {label} {new Date(r.joinedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {showStatus && r.status ? ` · ${r.status === 'approved' ? 'Approved' : 'Pending review'}` : ''}
          </Text>
          {!!r.note && <Text style={[s.runnerMeta, { fontStyle: 'italic' }]}>"{r.note}"</Text>}
        </View>
        {!showStatus && children}
      </View>
      {showStatus && children}
    </View>
  );
}

function Row({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
      <Ionicons name={icon} size={16} color={colors.emeraldDeep} />
      <Text style={{ marginLeft: 8, color: colors.muted, flex: 1 }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { padding: 20 },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  pillTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 22, marginBottom: 10 },
  copy: { color: colors.muted, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  facility: { flexDirection: 'row', alignItems: 'center', width: '46%' },
  prizeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.btn, padding: 14, gap: 12 },
  prizePlace: { fontSize: 14, fontWeight: '800', color: colors.emeraldDeep, width: 44 },
  prizeTxt: { fontSize: 15, color: colors.text, fontWeight: '600', flex: 1 },
  note: { marginTop: 18, fontSize: 12, color: colors.muted, lineHeight: 18 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, height: 46, gap: 8, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  filters: { flexDirection: 'row', gap: 8, marginVertical: 12, flexWrap: 'wrap' },
  filterPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  filterOn: { backgroundColor: colors.forestDark, borderColor: colors.forestDark },
  filterTxt: { fontSize: 12, fontWeight: '700', color: colors.text },
  runner: { backgroundColor: '#fff', borderRadius: radius.card, padding: 14, marginBottom: 10, gap: 10 },
  runnerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  runnerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  runnerMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.emerald, alignItems: 'center' },
  actionOk: { backgroundColor: colors.emerald },
  actionTxt: { fontWeight: '700', fontSize: 13, color: colors.emeraldDeep },
  checkBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.emerald },
  checkBtnOn: { backgroundColor: colors.emerald },
  checkTxt: { color: colors.emeraldDeep, fontWeight: '700', fontSize: 12 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 32, backgroundColor: '#fff', borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  price: { fontSize: 20, fontWeight: '800', color: colors.text },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
