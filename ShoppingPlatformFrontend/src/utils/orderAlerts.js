// تنبيه صوتي للطلب الجديد في لوحة التاجر — نغمة قصيرة مولّدة (بلا ملف صوت)
// المتصفح لا يسمح بالصوت قبل أول تفاعل للمستخدم، لذلك يُهيّأ السياق عند أول نقرة

const SOUND_KEY = 'vendor-order-sound'
let ctx = null

const unlock = () => {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* متصفح بلا Web Audio */ }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
  window.addEventListener('keydown', unlock, { once: true, capture: true })
}

export const isOrderSoundOn = () => {
  try { return localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true }
}

export const setOrderSoundOn = (on) => {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off') } catch { /* */ }
  if (on) { unlock(); playChime() }
}

// نغمتان صاعدتان، مرتين
export const playChime = () => {
  if (!isOrderSoundOn()) return
  try {
    unlock()
    if (!ctx) return
    const start = ctx.currentTime
    ;[0, 0.45].forEach(offset => {
      ;[[880, 0], [1320, 0.16]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const t = start + offset + delay
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.32)
      })
    })
  } catch { /* */ }
}
