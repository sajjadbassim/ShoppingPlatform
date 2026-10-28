import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { onBeforeLogout, registerDevice, removeDevice, useSessionStore } from '@wasit/shared';
import { goOrders } from './nav';

const TOKEN_KEY = 'seller-fcm-device-token';
// يجب أن يطابق قناة الباك (FcmSender.AndroidChannelId = "default")، وإلا تذهب الرسائل إلى قناة Firebase الاحتياطية
const CHANNEL_ID = 'default';

// والتطبيق مفتوح يظهر الإشعار كشريط نظام أيضاً: البائع قد يكون على شاشة أخرى
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Expo Go لا يدعم FCM؛ وiOS يحتاج إعداد APNs/Firebase منفصلاً (لم يُجهَّز بعد)
const supported = () => Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let currentToken: string | null = null;

async function obtainToken(): Promise<string | null> {
  // قناة بأهمية عالية لصوت مميز عند وصول طلب جديد
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'الطلبات الجديدة',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const token = await Notifications.getDevicePushTokenAsync();
  return typeof token.data === 'string' ? token.data : null;
}

// الخروج: نزيل رمز الجهاز من الخادم أولاً حتى لا تصل طلبات هذا المتجر إلى الهاتف بعد خروج صاحبه
onBeforeLogout(async () => {
  const token = currentToken ?? (await AsyncStorage.getItem(TOKEN_KEY));
  if (!token) return;
  await removeDevice(token).catch(() => {});
  currentToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
});

// تسجيل الجهاز عند الدخول، وتحديث الشاشات عند وصول إشعار، وفتح الطلبات عند الضغط عليه
export function usePushNotifications() {
  const signedIn = useSessionStore((s) => s.signedIn);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!signedIn || !supported()) return;
    let cancelled = false;
    const sync = async (token: string | null) => {
      if (!token || cancelled) return;
      await registerDevice(token, 'android', 'seller');
      currentToken = token;
      await AsyncStorage.setItem(TOKEN_KEY, token);
    };
    obtainToken()
      .then(sync)
      .catch((e) => __DEV__ && console.warn('[push] فشل تسجيل الجهاز', e));
    const tokenSub = Notifications.addPushTokenListener((t) => {
      if (typeof t.data === 'string') sync(t.data).catch(() => {});
    });
    // طلب جديد أو تغيّر حالته: نحدّث الأرقام والقوائم فوراً بدل انتظار دورة الدقيقة
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      for (const key of ['v-orders', 'v-dashboard', 'v-return-trips', 'v-reviews', 'v-review-summary', 'v-products'])
        queryClient.invalidateQueries({ queryKey: [key] });
    });
    // الضغط على الإشعار يفتح قائمة الطلبات التي تنتظر قرار البائع
    const openOrders = () => goOrders('orders', 'PENDING_CONFIRMATION');
    if (Notifications.getLastNotificationResponse()) openOrders();
    const responseSub = Notifications.addNotificationResponseReceivedListener(openOrders);
    return () => {
      cancelled = true;
      tokenSub.remove();
      receivedSub.remove();
      responseSub.remove();
    };
  }, [signedIn, queryClient]);
}
