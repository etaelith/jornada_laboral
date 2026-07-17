import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function scheduleWeeklyReviewReminder(): Promise<void> {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error('Habilitá las notificaciones en los ajustes del sistema.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('recordatorios', {
      name: 'Recordatorios laborales',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Revisá tus jornadas',
      body: 'Completá los registros pendientes y prepará tu exportación semanal.',
      data: { destination: 'calendar' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 6,
      hour: 18,
      minute: 0,
      channelId: 'recordatorios',
    },
  });
}
