// In-app notifications without Firebase.
// New rows in public.notifications for this user are shown as phone notifications
// while the app is running. Closed-app delivery needs Google's FCM and is not used.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Pacekin',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#10B981',
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.status === 'granted';
  } catch (e) {
    console.warn('Notification permission unavailable:', e);
    return false;
  }
}

// Listens for this runner's new notifications and shows each one as a phone notification.
// Returns a cleanup function.
export function startNotificationListener(userId: string) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      async (payload) => {
        const n: any = payload.new;
        try {
          await Notifications.scheduleNotificationAsync({
            content: { title: n.title, body: n.body ?? '', data: { ...(n.data ?? {}) } },
            trigger: null,
          });
        } catch (e) {
          console.warn('Could not show notification:', e);
        }
      })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
