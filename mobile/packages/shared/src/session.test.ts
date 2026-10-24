import axios from 'axios';
import {
  clearSession,
  configureSessionStorage,
  expiresInMs,
  getAccessToken,
  getFreshAccessToken,
  getRefreshToken,
  loadSession,
  refreshSession,
  saveSession,
  useSessionStore,
} from './session';

jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

const post = axios.post as jest.Mock;

// توكن JWT شكلي بانتهاء محدد (التوقيع لا يُفحص في التطبيق)
const jwt = (secondsLeft: number) => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsLeft }));
  return `h.${payload.replace(/=+$/, '')}.s`;
};

const serverSession = (token: string, refreshToken: string) => ({ data: { data: { token, refreshToken } } });

// تخزين في الذاكرة يحاكي SecureStore (غير متزامن)
const makeStorage = () => {
  const map = new Map<string, string>();
  return {
    map,
    adapter: {
      getItem: async (k: string) => map.get(k) ?? null,
      setItem: async (k: string, v: string) => void map.set(k, v),
      removeItem: async (k: string) => void map.delete(k),
    },
  };
};

describe('session', () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
    configureSessionStorage(storage.adapter);
    clearSession();
    post.mockReset();
  });

  it('حفظ الجلسة ومسحها', () => {
    saveSession({ token: 'a', refreshToken: 'r' });
    expect(getAccessToken()).toBe('a');
    expect(getRefreshToken()).toBe('r');
    expect(useSessionStore.getState().signedIn).toBe(true);

    clearSession();
    expect(getAccessToken()).toBe(null);
    expect(getRefreshToken()).toBe(null);
    expect(useSessionStore.getState().signedIn).toBe(false);
  });

  it('الجلسة الكاملة (الدور مثلاً) تصل المخزن لا التوكن فقط', () => {
    saveSession({ token: 'a', refreshToken: 'r', role: 'VENDOR' });
    expect(useSessionStore.getState().session?.role).toBe('VENDOR');
  });

  it('عند فتح التطبيق تُحمَّل الرموز من التخزين الآمن إلى الذاكرة', async () => {
    storage.map.set('accessToken', 'saved-a');
    storage.map.set('refreshToken', 'saved-r');

    await loadSession();

    expect(getAccessToken()).toBe('saved-a');
    expect(getRefreshToken()).toBe('saved-r');
    expect(useSessionStore.getState()).toMatchObject({ ready: true, signedIn: true });
  });

  it('الحفظ والمسح يصلان للتخزين الآمن', async () => {
    saveSession({ token: 'a', refreshToken: 'r' });
    await Promise.resolve();
    expect(storage.map.get('accessToken')).toBe('a');
    expect(storage.map.get('refreshToken')).toBe('r');

    clearSession();
    await Promise.resolve();
    expect(storage.map.size).toBe(0);
  });

  it('عمر التوكن من exp، والتوكن التالف = 0', () => {
    expect(expiresInMs(jwt(120))).toBeGreaterThan(100_000);
    expect(expiresInMs('garbage')).toBe(0);
  });

  it('طلبات كثيرة تفشل معاً ← تجديد واحد فقط (الرمز يُدوَّر)', async () => {
    saveSession({ token: 'old', refreshToken: 'r1' });
    post.mockResolvedValue(serverSession('new', 'r2'));

    const tokens = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(tokens).toEqual(['new', 'new', 'new']);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toEqual({ refreshToken: 'r1' });
    expect(getRefreshToken()).toBe('r2');
  });

  it('بلا رمز تجديد ← يفشل التجديد دون طلب للخادم', async () => {
    await expect(refreshSession()).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it('بعد فشل التجديد يمكن المحاولة من جديد (لا يعلق الوعد)', async () => {
    saveSession({ token: 'old', refreshToken: 'r1' });
    post.mockRejectedValueOnce(new Error('network'));
    await expect(refreshSession()).rejects.toThrow('network');

    post.mockResolvedValueOnce(serverSession('new', 'r2'));
    await expect(refreshSession()).resolves.toBe('new');
  });

  it('SignalR: التوكن الصالح يُعاد كما هو، والقريب من الانتهاء يُجدَّد', async () => {
    const valid = jwt(600);
    saveSession({ token: valid, refreshToken: 'r1' });
    await expect(getFreshAccessToken()).resolves.toBe(valid);

    saveSession({ token: jwt(10), refreshToken: 'r1' });
    post.mockResolvedValue(serverSession('renewed', 'r2'));
    await expect(getFreshAccessToken()).resolves.toBe('renewed');
  });
});

describe('فشل قراءة التخزين', () => {
  it('يعني «غير مسجّل» ويرفع حاجز الجاهزية بدل أن تبقى الشاشة سوداء', async () => {
    configureSessionStorage({
      getItem: async () => {
        throw new Error('SecureStore is not available');
      },
      setItem: async () => {},
      removeItem: async () => {},
    });
    useSessionStore.setState({ ready: false, signedIn: true });

    await loadSession();

    expect(useSessionStore.getState()).toMatchObject({ ready: true, signedIn: false });
    expect(getAccessToken()).toBeNull();
  });
});
