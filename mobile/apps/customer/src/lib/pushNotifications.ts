import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  fetchCustomerOrders,
  onBeforeLogout,
  pushTargetFromUrl,
  registerDevice,
  removeDevice,
  useSessionStore,
  type AuthUser,
} from '@wasit/shared';

const TOKEN_KEY = 'fcm-device-token';
// المستخدم أوقف إشعارات هذا الجهاز من الإعدادات: لا نعيد التسجيل تلقائياً عند الدخول
const DISABLED_KEY = 'push-device-disabled';
const CHANNEL_ID = 'default';

// والتطبيق مفتوح يصل الإشعار عبر SignalR ويظهر داخل التطبيق، فلا نكرره بإشعار نظام
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Expo Go لا يدعم FCM؛ وiOS يحتاج إعداد APNs/Firebase منفصلاً (لم يُجهَّز بعد)
const supported = () => Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let currentToken: string | null = null;

const loadToken = async () => currentToken ?? (currentToken = await AsyncStorage.getItem(TOKEN_KEY));

const saveToken = async (token: string) => {
  currentToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
};

// يطلب الإذن عند أول دخول (أندرويد 13+ يعرض نافذة النظام)، ويعيد رمز FCM أو null
async function obtainToken(): Promise<string | null> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'إشعارات الطلبات',
    importance: Notifications.AndroidImportance.HIGH,
  });
  // أندرويد 13+ يعيد «denied» قبل أول طلب (مع canAskAgain=true)، فلا نعتمد على «undetermined»
  let permission = await Notifications.getPermissionsAsync();
  if (__DEV__) console.log('[push] حالة الإذن', permission.status, permission.canAskAgain);
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const token = await Notifications.getDevicePushTokenAsync();
  if (__DEV__) console.log('[push] رمز FCM', typeof token.data === 'string' ? token.data.slice(0, 12) + '…' : token.data);
  return typeof token.data === 'string' ? token.data : null;
}

// الخروج: نزيل رمز الجهاز من الخادم أولاً (يحتاج الجلسة)، حتى لا تصل إشعارات الحساب السابق لهذا الجهاز
onBeforeLogout(async () => {
  const token = await loadToken();
  if (!token) return;
  await removeDevice(token).catch(() => {});
  currentToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
});
onBeforeLogout(async () => {
  await AsyncStorage.removeItem(DISABLED_KEY);
});

// ضغط الإشعار: «orders/ORD-…» يحتاج معرّف الطلب فنبحث عنه في طلبات الزبون
async function openFromNotification(data: Record<string, unknown> | undefined, userId?: string) {
  const target = pushTargetFromUrl(typeof data?.url === 'string' ? data.url : null);
  if (target.kind === 'returns') return router.push('/returns');
  if (target.kind === 'order' && userId) {
    const orders = await fetchCustomerOrders(userId).catch(() => []);
    const order = orders.find((o) => o.orderNumber === target.orderNumber);
    if (order) return router.push({ pathname: '/order/[id]', params: { id: order.id } });
  }
  router.push('/notifications');
}

// تسجيل الجهاز عند الدخول + فتح الشاشة المناسبة عند الضغط على إشعار (والتطبيق مغلق أو في الخلفية)
export function usePushNotifications() {
  const signedIn = useSessionStore((s) => s.signedIn);
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  const userId = user?.userId;

  useEffect(() => {
    if (!signedIn || !supported()) {
      if (__DEV__) console.log('[push] غير مفعّل', { signedIn, supported: supported(), env: Constants.executionEnvironment, os: Platform.OS });
      return;
    }
    let cancelled = false;

    if (__DEV__) console.log('[push] بدء التسجيل');
    const sync = async (token: string | null) => {
      if (!token || cancelled) return;
      await registerDevice(token, 'android', 'customer');
      await saveToken(token);
    };

    AsyncStorage.getItem(DISABLED_KEY)
      .then((disabled) => (disabled ? null : obtainToken()))
      .then(sync)
      .catch((e) => __DEV__ && console.warn('[push] فشل تسجيل الجهاز', e));
    // يتغير الرمز أحياناً (إعادة تثبيت، مسح بيانات): نعيد ربطه
    const sub = Notifications.addPushTokenListener((t) => {
      if (typeof t.data === 'string') sync(t.data).catch(() => {});
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [signedIn, userId]);

  useEffect(() => {
    if (!signedIn || !supported()) return;
    // تطبيق كان مغلقاً وفُتح بالضغط على إشعار
    const last = Notifications.getLastNotificationResponse();
    if (last) openFromNotification(last.notification.request.content.data, userId);
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      openFromNotification(r.notification.request.content.data, userId),
    );
    return () => sub.remove();
  }, [signedIn, userId]);
}

// ===== إعدادات «إشعارات هذا الجهاز» =====
export type DevicePushStatus = {
  supported: boolean;
  // مفعّلة فعلاً: الإذن ممنوح والمستخدم لم يوقفها ورمز الجهاز مسجَّل
  enabled: boolean;
  // الإذن محجوب من النظام ولا يمكن طلبه ثانية: الحل فتح إعدادات النظام
  blocked: boolean;
};

export async function getDevicePushStatus(): Promise<DevicePushStatus> {
  if (!supported()) return { supported: false, enabled: false, blocked: false };
  const [permission, disabled, token] = await Promise.all([
    Notifications.getPermissionsAsync(),
    AsyncStorage.getItem(DISABLED_KEY),
    loadToken(),
  ]);
  return {
    supported: true,
    enabled: permission.granted && !disabled && !!token,
    blocked: !permission.granted && !permission.canAskAgain,
  };
}

// تشغيل: يطلب الإذن إن لزم ثم يسجّل الجهاز. النتيجة 'blocked' = على المستخدم السماح من إعدادات النظام
export async function enableDevicePush(): Promise<'enabled' | 'denied' | 'blocked' | 'unsupported'> {
  if (!supported()) return 'unsupported';
  await AsyncStorage.removeItem(DISABLED_KEY);
  const token = await obtainToken();
  if (!token) {
    const permission = await Notifications.getPermissionsAsync();
    return permission.canAskAgain ? 'denied' : 'blocked';
  }
  await registerDevice(token, 'android', 'customer');
  await saveToken(token);
  return 'enabled';
}

// إيقاف: نزيل رمز الجهاز من الخادم (لا تصل إشعارات)، ونتذكّر الإيقاف حتى لا يُعاد التسجيل عند الدخول
export async function disableDevicePush(): Promise<void> {
  await AsyncStorage.setItem(DISABLED_KEY, '1');
  const token = await loadToken();
  if (token) await removeDevice(token).catch(() => {});
  currentToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}
