import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  clearSession,
  expiresInMs,
  getAccessToken,
  getFreshAccessToken,
  getRefreshToken,
  refreshSession,
  saveSession,
} from './session'

vi.mock('axios', () => ({ default: { post: vi.fn() } }))

// localStorage بسيط لبيئة node
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

// توكن JWT شكلي بانتهاء محدد (التوقيع لا يُفحص في الواجهة)
const jwt = (secondsLeft) => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsLeft }))
  return `h.${payload.replace(/=+$/, '')}.s`
}

const serverSession = (token, refreshToken) => ({ data: { data: { token, refreshToken } } })

describe('session', () => {
  beforeEach(() => {
    store.clear()
    axios.post.mockReset()
  })

  it('حفظ الجلسة ومسحها', () => {
    saveSession({ token: 'a', refreshToken: 'r' })
    expect(getAccessToken()).toBe('a')
    expect(getRefreshToken()).toBe('r')
    clearSession()
    expect(getAccessToken()).toBe(null)
    expect(getRefreshToken()).toBe(null)
  })

  it('عمر التوكن من exp، والتوكن التالف = 0', () => {
    expect(expiresInMs(jwt(120))).toBeGreaterThan(100_000)
    expect(expiresInMs('garbage')).toBe(0)
  })

  it('طلبات كثيرة تفشل معاً ← تجديد واحد فقط (الرمز يُدوَّر)', async () => {
    saveSession({ token: 'old', refreshToken: 'r1' })
    axios.post.mockResolvedValue(serverSession('new', 'r2'))

    const tokens = await Promise.all([refreshSession(), refreshSession(), refreshSession()])

    expect(tokens).toEqual(['new', 'new', 'new'])
    expect(axios.post).toHaveBeenCalledTimes(1)
    expect(axios.post.mock.calls[0][1]).toEqual({ refreshToken: 'r1' })
    expect(getRefreshToken()).toBe('r2')
  })

  it('تبويب آخر جدّد قبلنا ← نستعمل جلسته بدل تسجيل الخروج', async () => {
    saveSession({ token: 'old', refreshToken: 'r1' })
    axios.post.mockImplementation(async () => {
      saveSession({ token: 'from-other-tab', refreshToken: 'r2' })   // حدث أثناء طلبنا
      throw Object.assign(new Error('401'), { response: { status: 401 } })
    })

    await expect(refreshSession()).resolves.toBe('from-other-tab')
  })

  it('بلا رمز تجديد ← يفشل التجديد', async () => {
    await expect(refreshSession()).rejects.toThrow()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('SignalR: التوكن الصالح يُعاد كما هو، والقريب من الانتهاء يُجدَّد', async () => {
    const valid = jwt(600)
    saveSession({ token: valid, refreshToken: 'r1' })
    await expect(getFreshAccessToken()).resolves.toBe(valid)

    saveSession({ token: jwt(10), refreshToken: 'r1' })
    axios.post.mockResolvedValue(serverSession('renewed', 'r2'))
    await expect(getFreshAccessToken()).resolves.toBe('renewed')
  })
})
