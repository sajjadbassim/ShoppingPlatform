import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GOOGLE_WEB_CLIENT_ID } from '@wasit/shared';

// الدخول بـ Google يعمل على أندرويد في development build (ليس Expo Go). iOS يحتاج عميل iOS وحساب Apple لاحقاً
export const googleAvailable = () =>
  Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && !!GOOGLE_WEB_CLIENT_ID;

// المكتبة وحدة أصلية: لا تُحمَّل إلا عند الاستعمال حتى لا ينهار التطبيق حيث لا تتوفر (Expo Go)
let configured = false;

// يفتح اختيار حساب Google ويعيد بطاقة الهوية (idToken) التي يتحقق منها الباك، أو null إن ألغى المستخدم
export async function pickGoogleCredential(): Promise<string | null> {
  const { GoogleSignin, isCancelledResponse } = require('@react-native-google-signin/google-signin');
  if (!configured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  await GoogleSignin.hasPlayServices();
  // نفصل الحساب السابق حتى تظهر قائمة اختيار الحساب في كل مرة
  await GoogleSignin.signOut().catch(() => {});
  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) return null;
  const idToken: string | null | undefined = response.data?.idToken;
  if (!idToken) throw new Error('تعذّر الحصول على بطاقة Google');
  return idToken;
}

// رسالة مفهومة لأخطاء المكتبة (DEVELOPER_ERROR = عميل Android غير مُعدّ في Google Cloud لهذه الحزمة والبصمة)
export function googleErrorMessage(e: unknown): string {
  const err = e as { code?: string | number; message?: string };
  const text = `${err?.code ?? ''} ${err?.message ?? ''}`;
  if (/DEVELOPER_ERROR|\b10\b/.test(text)) return 'إعداد Google غير مكتمل لهذه النسخة. تواصل مع الدعم.';
  if (/PLAY_SERVICES_NOT_AVAILABLE/.test(text)) return 'خدمات Google Play غير متوفرة على هذا الجهاز';
  if (/IN_PROGRESS/.test(text)) return 'جاري تسجيل الدخول بالفعل';
  return err?.message || 'تعذّر الدخول بحساب Google';
}
