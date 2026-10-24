import axios from 'axios';
import { create } from 'zustand';
import { API_URL } from './config';

// الجلسة: توكن دخول قصير (ساعة) + رمز تجديد (30 يوماً) يتبدّل مع كل تجديد.
// الخادم يرفض الرمز القديم بعد تدويره، لذلك التجديد يجب أن يحدث مرة واحدة فقط مهما فشلت طلبات معاً.
// الفرق عن الويب: التخزين غير متزامن (SecureStore)، فتُحمَّل الرموز مرة في الذاكرة عند فتح التطبيق (loadSession).

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export interface SessionStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// ردّ الخادم في الدخول والتسجيل والتجديد (الحقول الأخرى كالدور ومعرّف المتجر تمرّ كما هي)
export interface SessionData {
  token?: string;
  refreshToken?: string;
  [key: string]: unknown;
}

interface SessionState {
  // آخر جلسة كاملة: الدور ومعرّف المتجر قد يتغيران (مثل اعتماد متجر الزبون)
  session: SessionData | null;
  // true بعد قراءة الرموز من التخزين عند فتح التطبيق
  ready: boolean;
  // true إن وُجد توكن دخول في الذاكرة
  signedIn: boolean;
}

export const useSessionStore = create<SessionState>(() => ({ session: null, ready: false, signedIn: false }));

const memoryStorage = (): SessionStorageAdapter => {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
};

let storage: SessionStorageAdapter = memoryStorage();
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const configureSessionStorage = (adapter: SessionStorageAdapter) => {
  storage = adapter;
};

// يُستدعى مرة عند فتح التطبيق قبل أول طلب
// فشل القراءة (تخزين غير مدعوم، أو بيانات تالفة) يعني «غير مسجّل دخول»، ولا يمنع فتح التطبيق أبداً
export const loadSession = async () => {
  try {
    accessToken = await storage.getItem(ACCESS_KEY);
    refreshToken = await storage.getItem(REFRESH_KEY);
  } catch {
    accessToken = null;
    refreshToken = null;
  }
  useSessionStore.setState({ ready: true, signedIn: !!accessToken });
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

// الذاكرة هي المرجع، والتخزين نسخة احتياطية لا ننتظرها
const persist = (key: string, value: string | null) => {
  const op = value === null ? storage.removeItem(key) : storage.setItem(key, value);
  op.catch(() => {});
};

// جلسة من ردّ الخادم: الدخول، التسجيل، Google، التجديد، تغيير كلمة المرور
export const saveSession = (data?: SessionData | null) => {
  if (data?.token) {
    accessToken = data.token;
    persist(ACCESS_KEY, data.token);
  }
  if (data?.refreshToken) {
    refreshToken = data.refreshToken;
    persist(REFRESH_KEY, data.refreshToken);
  }
  if (data?.token) useSessionStore.setState({ session: data, signedIn: true });
};

// دمج حقول في الجلسة المعروضة (الاسم والبريد...) دون المساس بالرموز
export const patchSession = (fields: Partial<SessionData>) =>
  useSessionStore.setState((state) => ({ session: { ...(state.session ?? {}), ...fields } }));

export const clearSession = () => {
  accessToken = null;
  refreshToken = null;
  persist(ACCESS_KEY, null);
  persist(REFRESH_KEY, null);
  useSessionStore.setState({ session: null, signedIn: false });
};

// إبطال رمز هذا الجهاز في الخادم — لا ننتظره ولا يُفشل الخروج
export const revokeSession = () => {
  if (refreshToken) axios.post(`${API_URL}/api/Auth/logout`, { refreshToken }).catch(() => {});
};

const decodeBase64Url = (input: string): string => {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  return globalThis.atob(b64);
};

// كم بقي من عمر التوكن (بالملي ثانية) — 0 إن تعذّرت قراءته
export const expiresInMs = (token: string): number => {
  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1]));
    return payload.exp * 1000 - Date.now();
  } catch {
    return 0;
  }
};

const doRefresh = async (): Promise<string> => {
  if (!refreshToken) throw new Error('no refresh token');
  const response = await axios.post(`${API_URL}/api/Auth/refresh-token`, { refreshToken });
  const data = response.data?.data as SessionData;
  saveSession(data);
  return data.token as string;
};

let inFlight: Promise<string> | null = null;

// تجديد واحد في نفس الوقت: كل الطلبات التي فشلت بـ 401 معاً تنتظر نفس النتيجة
export const refreshSession = (): Promise<string> => {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};

// توكن صالح لدقيقة على الأقل — لاتصالات SignalR التي لا تمر عبر axios
export const getFreshAccessToken = async (): Promise<string> => {
  const token = accessToken;
  if (!token) return '';
  if (expiresInMs(token) > 60_000) return token;
  try {
    return await refreshSession();
  } catch {
    return token;
  }
};
