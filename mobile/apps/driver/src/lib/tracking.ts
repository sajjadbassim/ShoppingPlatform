import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { postDriverLocation } from '@wasit/shared';

// تتبّع الموقع في الخلفية أثناء الدوام فقط. المهمة تُعرَّف على مستوى الوحدة ليجدها النظام حين يوقظ التطبيق
export const TRACKING_TASK = 'wasit-driver-tracking';

TaskManager.defineTask(TRACKING_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const last = locations?.[locations.length - 1];
  if (!last) return;
  // الخادم يقبل نقطة واحدة فقط (ويتجاهل الأسرع من 3 ثوانٍ): نرسل آخر نقطة، وفشل الشبكة يُتجاوز
  await postDriverLocation(last.coords.latitude, last.coords.longitude, last.coords.accuracy).catch(() => {});
});

export type TrackingPermission = 'always' | 'foreground' | 'denied';

// الإذن الحالي بلا طلب
export async function getTrackingPermission(): Promise<TrackingPermission> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) return 'denied';
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.granted ? 'always' : 'foreground';
}

// يطلب إذن «أثناء الاستخدام» ثم إذن «طوال الوقت» (أندرويد يطلبهما بالتتابع). يُستدعى بعد شاشة الشرح
export async function requestTrackingPermission(): Promise<TrackingPermission> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted ? 'always' : 'foreground';
}

export const isTracking = async (): Promise<boolean> =>
  (await TaskManager.isTaskRegisteredAsync(TRACKING_TASK)) && (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK));

// يبدأ التتبّع (25 متراً أو 15 ثانية) مع إشعار دائم «أنت في الخدمة». آمن للاستدعاء المتكرر
export async function startTracking(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if ((await getTrackingPermission()) !== 'always') return false;
  if (await isTracking()) return true;
  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 25,
    timeInterval: 15 * 1000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'وسيط مندوب — أنت في الخدمة',
      notificationBody: 'نتتبّع موقعك أثناء دوامك فقط',
      notificationColor: '#4F46E5',
    },
  });
  return true;
}

export async function stopTracking(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await isTracking()) await Location.stopLocationUpdatesAsync(TRACKING_TASK);
}
