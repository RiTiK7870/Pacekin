import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertButton, setAlertHandler } from '../lib/alert';
import { colors, radius } from '../lib/config';

type State = { title: string; message?: string; buttons: AlertButton[] } | null;

export default function AlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    setAlertHandler((title, message, buttons) =>
      setState({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] }));
    return () => setAlertHandler(null);
  }, []);

  const close = (btn?: AlertButton) => {
    setState(null);
    btn?.onPress?.();
  };

  return (
    <>
      {children}
      <Modal transparent visible={!!state} animationType="fade" onRequestClose={() => close()}>
        <View style={s.backdrop}>
          <View style={s.card}>
            <View style={s.accent} />
            <Text style={s.title}>{state?.title}</Text>
            {!!state?.message && <Text style={s.message}>{state.message}</Text>}
            <View style={s.buttons}>
              {state?.buttons.map((b, i) => {
                const destructive = b.style === 'destructive';
                const primary = !b.style || b.style === 'default';
                return (
                  <Pressable
                    key={i}
                    onPress={() => close(b)}
                    style={({ pressed }) => [
                      s.btn,
                      primary && s.btnPrimary,
                      !primary && s.btnOutline,
                      pressed && { opacity: 0.8 },
                    ]}>
                    <Text style={[
                      s.btnTxt,
                      primary && { color: '#fff' },
                      destructive && { color: colors.danger },
                    ]}>
                      {b.text ?? 'OK'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,42,33,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: radius.card, padding: 22, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, elevation: 10 },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: colors.emerald },
  title: { fontSize: 19, fontWeight: '800', color: colors.forest, marginTop: 6 },
  message: { fontSize: 15, color: colors.muted, marginTop: 10, lineHeight: 22 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  btn: { minWidth: 96, height: 46, borderRadius: radius.btn, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: colors.forestDark },
  btnOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  btnTxt: { fontSize: 15, fontWeight: '700', color: colors.text },
});
