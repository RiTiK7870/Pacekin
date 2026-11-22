import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, IMAGES, radius } from '../lib/config';

type Variant = 'solid' | 'light' | 'ghost' | 'outline';
const variantStyle: Record<Variant, { box: ViewStyle; text: object }> = {
  solid: { box: { backgroundColor: colors.forestDark }, text: { color: '#fff' } },
  light: { box: { backgroundColor: '#fff' }, text: { color: colors.text } },
  ghost: { box: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }, text: { color: '#fff' } },
  outline: { box: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border }, text: { color: colors.text } },
};

export function PrimaryButton({ title, onPress, variant = 'solid', loading, disabled, style }:
  { title: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const v = variantStyle[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, v.box, disabled && { opacity: 0.45 }, pressed && { opacity: 0.85 }, style]}>
      {loading ? <ActivityIndicator color={colors.emerald} /> : <Text style={[s.btnTxt, v.text]}>{title}</Text>}
    </Pressable>
  );
}

/** Circular category icon used in the header row of the reference design. */
export function CategoryIcon({ label, icon, onPress }: { label: string; icon: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', width: 64 }} accessibilityRole="button" accessibilityLabel={label}>
      <View style={s.catCircle}><Ionicons name={icon} size={22} color={colors.emeraldDeep} /></View>
      <Text style={s.catLabel}>{label}</Text>
    </Pressable>
  );
}

export function EventCard({ event, onPress }: { event: any; onPress: () => void }) {
  const left = event.capacity - event.registered_count;
  return (
    <Pressable onPress={onPress} style={s.card} accessibilityRole="button">
      <View>
        <EventCover uri={event.cover_url} height={160} />
        <View style={s.pill}><Text style={s.pillTxt}>{event.distance_km ? `${event.distance_km} km` : event.category}</Text></View>
      </View>
      <View style={{ padding: 14 }}>
        <Text style={s.cardTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={s.meta} numberOfLines={1}>{event.city} · {new Date(event.starts_at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
        <Text style={[s.meta, { color: left <= 0 ? colors.danger : colors.emeraldDeep, fontWeight: '600' }]}>
          {left <= 0 ? 'FULL' : `${left} spots left`}{event.is_paid ? `  ·  Paid ₹${event.entry_fee}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export function EventCover({ uri, height = 160 }: { uri?: string | null; height?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: '100%', height }} contentFit="cover" />;
  return (
    <View style={{ width: '100%', height, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="image-outline" size={34} color="rgba(255,255,255,0.7)" />
      <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 6, fontSize: 12 }}>No cover photo</Text>
    </View>
  );
}

export function Notice({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={{ padding: 24, alignItems: 'center' }}>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>{text}</Text>
      {onRetry && <PrimaryButton title="Try again" variant="outline" onPress={onRetry} style={{ marginTop: 12, paddingHorizontal: 24 }} />}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { height: 56, borderRadius: radius.btn, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, flexDirection: 'row' },
  btnTxt: { fontSize: 16, fontWeight: '600' },
  catCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  catLabel: { fontSize: 12, color: '#FFFFFF', fontWeight: '600', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: radius.card, overflow: 'hidden', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  cardImg: { width: '100%', height: 160 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  pill: { position: 'absolute', right: 12, bottom: 12, backgroundColor: colors.emerald, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pillTxt: { color: '#fff', fontWeight: '700' },
});
