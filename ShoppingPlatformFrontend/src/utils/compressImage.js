// تصغير صور الجوال قبل الرفع: صور الكاميرا الحديثة 4–10MB والحد في الخادم 5MB،
// والرفع على بيانات الهاتف بطيء. نصغّر أطول ضلع إلى 1600px ونحفظ JPEG بجودة 0.85.
// الصور الصغيرة أصلاً و GIF (قد تكون متحركة) تبقى كما هي.

const MAX_SIDE = 1600
const QUALITY = 0.85
const SKIP_BELOW = 600 * 1024

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّرت قراءة الصورة')) }
  img.src = url
})

export const compressImage = async (file, { maxSide = MAX_SIDE, quality = QUALITY } = {}) => {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const img = await loadImage(file)
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale === 1 && file.size < SKIP_BELOW) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    // خلفية بيضاء للصور الشفافة (PNG) لأن JPEG بلا شفافية
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file   // الخادم يرفض ما لا يصلح برسالته المعتادة
  }
}

export const compressImages = (files, options) => Promise.all(files.map(f => compressImage(f, options)))
