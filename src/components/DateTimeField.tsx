import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './ui';
import { colors, radius } from '../lib/config';

type Mode = 'date' | 'time' | 'datetime';
type Props = {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  dateOnly?: boolean;
};

// iOS: one spinner (date + time, or date only). Android: date dialog, then time dialog (or date only).
export default function DateTimeField({ label, value, onChange, minimumDate, maximumDate, dateOnly = false }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [draft, setDraft] = useState<Date>(value);

  const open = () => {
    setDraft(value);
    setMode(Platform.OS === 'ios' && !dateOnly ? 'datetime' : 'date');
  };

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'ios') {
      if (selected) { setDraft(selected); onChange(selected); }
      return;
    }
    if (event.type !== 'set' || !selected) { setMode(null); return; }
    if (mode === 'date') {
      const d = new Date(draft);
      d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      if (dateOnly) { onChange(d); setMode(null); return; }
      setDraft(d);
      setMode('time');
    } else if (mode === 'time') {
      const d = new Date(draft);
      d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      onChange(d);
      setMode(null);
    }
  };

  const text = dateOnly
    ? value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : value.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <Pressable style={s.box} onPress={open} accessibilityRole="button">
        <Text style={s.value}>{text}</Text>
        <Ionicons name={dateOnly ? 'calendar-outline' : 'time-outline'} size={20} color={colors.forest} />
      </Pressable>
      {mode && (
        <View>
          <DateTimePicker
            value={draft}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={onPick}
          />
          {Platform.OS === 'ios' && (
            <PrimaryButton title="Done" variant="outline" onPress={() => setMode(null)} style={{ marginTop: 8 }} />
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  box: { backgroundColor: '#fff', borderRadius: radius.btn, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { fontSize: 16, color: colors.text, flex: 1 },
});
