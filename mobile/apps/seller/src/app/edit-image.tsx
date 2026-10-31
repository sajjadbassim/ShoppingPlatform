import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, I18nManager, PanResponder, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Canvas, ColorMatrix, ImageFormat, Rect as SkRect, Shadow, Image as SkImage, Skia, useImage } from '@shopify/react-native-skia';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { removeProductImageBackground } from '@wasit/shared';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';
import { finishEdit } from '../lib/imageEditor';
import { toast } from '../lib/toast';
import { useVendorId } from '../lib/vendor';

// alpha = الصورة بلا خلفية (PNG شفاف من الخادم): تُحفظ PNG في كل خطوة بعدها كي لا تضيع الشفافية
type Step = { uri: string; w: number; h: number; alpha?: boolean };
type Tab = 'crop' | 'enhance' | 'background';
type Adjust = { brightness: number; contrast: number; saturation: number };
type Rect = { x: number; y: number; w: number; h: number };
// إطار القص ثابت على الشاشة، والصورة تُسحب وتُكبَّر تحته (s = بكسل الشاشة لكل بكسل صورة، cx/cy = مركز الصورة)
type CropView = { frame: Rect; s: number; cx: number; cy: number };
type Corner = 'tl' | 'tr' | 'bl' | 'br';

// قيم التحسين بمقياس موحّد من -100 إلى +100 (0 = بلا تغيير) تظهر كما هي في المنزلق
const NEUTRAL: Adjust = { brightness: 0, contrast: 0, saturation: 0 };
// «تلقائي»: رفع خفيف للسطوع والتباين والألوان يناسب أغلب صور المنتجات
const AUTO: Adjust = { brightness: 10, contrast: 20, saturation: 10 };
const MAX_SIDE = 2048;
const MARGIN = 8;
const MIN_FRAME = 72;
const MAX_ZOOM = 6;
// ألوان الخلفية بعد الإزالة (null = شفاف). تُرسم كما هي في الوضعين لأنها لون الصورة نفسها
const BACKGROUNDS: { label: string; color: string | null }[] = [
  { label: 'أبيض', color: '#FFFFFF' },
  { label: 'رمادي', color: '#EFEFEF' },
  { label: 'بيج', color: '#F4ECE1' },
  { label: 'أسود', color: '#151515' },
  { label: 'شفاف', color: null },
];
const saveOpts = (alpha?: boolean) => (alpha ? { format: SaveFormat.PNG } : { format: SaveFormat.JPEG, compress: 0.92 });
// ظل ناعم تحت المنتج بنسبة من ارتفاع الصورة، فيبدو نفسه في المعاينة والصورة المحفوظة
const shadowFor = (h: number) => ({ dy: h * 0.02, blur: h * 0.025 });
const SHADOW_COLOR = 'rgba(0,0,0,0.28)';
const RATIOS: { key: string; label: string; value: number | null }[] = [
  { key: 'free', label: 'حر', value: null },
  { key: 'orig', label: 'الأصلي', value: null },
  { key: '1:1', label: '1:1', value: 1 },
  { key: '4:5', label: '4:5', value: 4 / 5 },
  { key: '3:4', label: '3:4', value: 3 / 4 },
];

// مصفوفة لون 4×5: التشبّع ثم التباين حول المنتصف ثم السطوع (الإزاحة بين 0 و1 كما في Skia)
const toMatrix = (a: Adjust): number[] => {
  const brightness = (a.brightness / 100) * 0.3;
  const contrast = 1 + (a.contrast / 100) * 0.5;
  const s = 1 + a.saturation / 100;
  const [lr, lg, lb] = [0.2126, 0.7152, 0.0722];
  const sat = [
    [lr * (1 - s) + s, lg * (1 - s), lb * (1 - s)],
    [lr * (1 - s), lg * (1 - s) + s, lb * (1 - s)],
    [lr * (1 - s), lg * (1 - s), lb * (1 - s) + s],
  ];
  const offset = 0.5 * (1 - contrast) + brightness;
  const m: number[] = [];
  for (const row of sat) m.push(row[0] * contrast, row[1] * contrast, row[2] * contrast, 0, offset);
  m.push(0, 0, 0, 1, 0);
  return m;
};

const isNeutral = (a: Adjust) => a.brightness === 0 && a.contrast === 0 && a.saturation === 0;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
// تقاطع مستطيلين (فارغ إن لم يتقاطعا): التعتيم يُرسم فوق الصورة فقط، لا فوق خلفية الصندوق
const intersect = (a: Rect, b: Rect): Rect => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
};

// منزلق بلا مكتبات: الضغط أو السحب على الشريط يحدد القيمة. الاتجاه يتبع اتجاه الواجهة (في العربية الزيادة نحو اليسار)
function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const start = useRef(0);
  const rtl = I18nManager.isRTL;
  const fromX = (x: number) => {
    const f = clamp(x / (widthRef.current || 1), 0, 1);
    return Math.round((rtl ? 1 - f : f) * 200 - 100);
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          start.current = e.nativeEvent.locationX;
          onChange(fromX(start.current));
        },
        onPanResponderMove: (_e, g) => onChange(fromX(start.current + g.dx)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const f = (value + 100) / 200;
  const x = (rtl ? 1 - f : f) * width;
  const mid = width / 2;
  return (
    <View style={{ flex: 1, height: 38, justifyContent: 'center' }} {...pan.panHandlers} onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; setWidth(e.nativeEvent.layout.width); }}>
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.fill, { left: rtl ? width - Math.max(x, mid) : Math.min(x, mid), width: Math.abs(x - mid) }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: rtl ? width - x - 11 : x - 11 }]} />
    </View>
  );
}

// يبقي الصورة مغطّية للإطار دائماً: لا أقل من حدّ التغطية، ولا حواف فارغة داخل الإطار
const normalize = (frame: Rect, s: number, cx: number, cy: number, iw: number, ih: number): CropView => {
  const min = Math.max(frame.w / iw, frame.h / ih);
  const ns = clamp(s, min, min * MAX_ZOOM);
  const hw = (iw * ns) / 2;
  const hh = (ih * ns) / 2;
  return { frame, s: ns, cx: clamp(cx, frame.x + frame.w - hw, frame.x + hw), cy: clamp(cy, frame.y + frame.h - hh, frame.y + hh) };
};

// تعديل صورة المنتج محلياً (يعمل على أندرويد وآيفون بلا إنترنت): قص وتدوير وتحسين الألوان
export default function EditImageScreen() {
  useTheme();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const [stack, setStack] = useState<Step[]>([]);
  const [adjust, setAdjust] = useState<Adjust>(NEUTRAL);
  const [tab, setTab] = useState<Tab>('crop');
  const [ratioKey, setRatioKey] = useState('free');
  const [busy, setBusy] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [cv, setCv] = useState<CropView | null>(null);
  const cvRef = useRef<CropView | null>(null);
  const done = useRef(false);
  const vendorId = useVendorId();
  const [bg, setBg] = useState<string | null>('#FFFFFF');
  const [shadow, setShadow] = useState(true);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  const current = stack[stack.length - 1];
  const image = useImage(current?.uri);
  const curRef = useRef<Step | undefined>(undefined);
  curRef.current = current;
  const boxRef = useRef(box);
  boxRef.current = box;

  const updateCv = (v: CropView | null) => {
    cvRef.current = v;
    setCv(v);
  };

  // أي خروج دون حفظ (رجوع النظام مثلاً) يُعدّ تخطّياً
  useEffect(
    () => () => {
      if (!done.current) finishEdit(null);
    },
    [],
  );

  // تثبيت اتجاه الصورة (EXIF) وتصغيرها لحدّ معقول قبل أي تعديل
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ref = await ImageManipulator.manipulate(uri).renderAsync();
        const scale = Math.min(1, MAX_SIDE / Math.max(ref.width, ref.height));
        const out = scale < 1 ? await ImageManipulator.manipulate(uri).resize(ref.width >= ref.height ? { width: MAX_SIDE } : { height: MAX_SIDE }).renderAsync() : ref;
        const saved = await out.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
        if (!cancelled) setStack([{ uri: saved.uri, w: saved.width, h: saved.height }]);
      } catch {
        if (!cancelled) {
          toast.error('تعذّر فتح الصورة للتعديل');
          close(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const close = (result: string | null) => {
    done.current = true;
    finishEdit(result);
    router.back();
  };

  const push = (s: Step) => setStack((p) => [...p, s]);

  // يضع إطاراً بالنسبة المطلوبة في منتصف الصندوق، والصورة تملؤه ومتمركزة
  const enterCrop = (key: string) => {
    const c = curRef.current;
    const b = boxRef.current;
    if (!c || !b.w || !b.h) return;
    const def = RATIOS.find((r) => r.key === key);
    const r = def?.value ?? c.w / c.h;
    const availW = b.w - MARGIN * 2;
    const availH = b.h - MARGIN * 2;
    const w = Math.min(availW, availH * r);
    const h = w / r;
    const frame = { x: (b.w - w) / 2, y: (b.h - h) / 2, w, h };
    updateCv(normalize(frame, 0, frame.x + w / 2, frame.y + h / 2, c.w, c.h));
  };

  // الإطار يظهر في تبويب القص فقط، ويُعاد وضعه عند تغيّر الصورة (بعد قص أو تدوير)
  useEffect(() => {
    if (tab === 'crop' && current && box.w && !busy) enterCrop(ratioKey);
    else updateCv(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, current?.uri, box.w, box.h, busy]);

  const pickRatio = (key: string) => {
    setRatioKey(key);
    enterCrop(key);
  };

  // سحب بإصبع واحد = تحريك الصورة، وبإصبعين = تكبير وتصغير حول مركز الإطار
  const gesture = useRef({ count: 0, s: 0, cx: 0, cy: 0, mx: 0, my: 0, d: 0 });
  const touchInfo = (touches: readonly { pageX: number; pageY: number }[]) => {
    const a = touches[0];
    const b = touches[1];
    return b
      ? { mx: (a.pageX + b.pageX) / 2, my: (a.pageY + b.pageY) / 2, d: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) }
      : { mx: a.pageX, my: a.pageY, d: 0 };
  };
  const imagePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gesture.current.count = 0;
        },
        onPanResponderMove: (e) => {
          const v = cvRef.current;
          const c = curRef.current;
          const touches = e.nativeEvent.touches;
          if (!v || !c || touches.length === 0) return;
          const t = touchInfo(touches);
          const g = gesture.current;
          // تغيّر عدد الأصابع يعيد خط الأساس حتى لا تقفز الصورة
          if (g.count !== touches.length) {
            Object.assign(g, { count: touches.length, s: v.s, cx: v.cx, cy: v.cy, mx: t.mx, my: t.my, d: t.d });
            return;
          }
          const k = g.d > 0 && t.d > 0 ? t.d / g.d : 1;
          const fcx = v.frame.x + v.frame.w / 2;
          const fcy = v.frame.y + v.frame.h / 2;
          updateCv(normalize(v.frame, g.s * k, fcx + (g.cx - fcx) * k + (t.mx - g.mx), fcy + (g.cy - fcy) * k + (t.my - g.my), c.w, c.h));
        },
      }),
    [],
  );

  // سحب زوايا الإطار (للقص الحر فقط): يتغير الإطار وتبقى الصورة مغطّية له
  const startFrame = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const makeCorner = (corner: Corner) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (cvRef.current) startFrame.current = cvRef.current.frame;
      },
      onPanResponderMove: (_e, g) => {
        const v = cvRef.current;
        const c = curRef.current;
        const b = boxRef.current;
        if (!v || !c) return;
        const r = startFrame.current;
        let x1 = r.x;
        let y1 = r.y;
        let x2 = r.x + r.w;
        let y2 = r.y + r.h;
        if (corner === 'tl' || corner === 'bl') x1 = clamp(r.x + g.dx, MARGIN, x2 - MIN_FRAME);
        else x2 = clamp(r.x + r.w + g.dx, x1 + MIN_FRAME, b.w - MARGIN);
        if (corner === 'tl' || corner === 'tr') y1 = clamp(r.y + g.dy, MARGIN, y2 - MIN_FRAME);
        else y2 = clamp(r.y + r.h + g.dy, y1 + MIN_FRAME, b.h - MARGIN);
        updateCv(normalize({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, v.s, v.cx, v.cy, c.w, c.h));
      },
    });
  const corners = useMemo(() => ({ tl: makeCorner('tl'), tr: makeCorner('tr'), bl: makeCorner('bl'), br: makeCorner('br') }), []);

  const rotate = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const r = await (await ImageManipulator.manipulate(current.uri).rotate(90).renderAsync()).saveAsync(saveOpts(current.alpha));
      push({ uri: r.uri, w: r.width, h: r.height, alpha: current.alpha });
    } catch {
      toast.error('تعذّر تدوير الصورة');
    } finally {
      setBusy(false);
    }
  };

  // يقصّ بما يقع داخل الإطار فعلاً، محوَّلاً من إحداثيات الشاشة إلى بكسلات الصورة
  const applyCrop = async () => {
    if (!current || !cv || busy) return;
    const { frame, s, cx, cy } = cv;
    const left = cx - (current.w * s) / 2;
    const top = cy - (current.h * s) / 2;
    const originX = clamp(Math.round((frame.x - left) / s), 0, current.w - 1);
    const originY = clamp(Math.round((frame.y - top) / s), 0, current.h - 1);
    const width = clamp(Math.round(frame.w / s), 1, current.w - originX);
    const height = clamp(Math.round(frame.h / s), 1, current.h - originY);
    if (width >= current.w - 1 && height >= current.h - 1) return toast.success('لا تغيير على القص');
    setBusy(true);
    try {
      const out = await (await ImageManipulator.manipulate(current.uri).crop({ originX, originY, width, height }).renderAsync()).saveAsync(saveOpts(current.alpha));
      push({ uri: out.uri, w: out.width, h: out.height, alpha: current.alpha });
    } catch {
      toast.error('تعذّر قص الصورة');
    } finally {
      setBusy(false);
    }
  };

  // إزالة الخلفية على الخادم (الصورة بحجمها كما هي). الناتج PNG شفاف يصير خطوة جديدة قابلة للتراجع
  const removeBackground = async () => {
    if (!current || busy || !vendorId) return;
    setBusy(true);
    setBusyLabel('جاري إزالة الخلفية…');
    const started = Date.now();
    try {
      const res = await removeProductImageBackground(vendorId, { uri: current.uri, name: current.alpha ? 'product.png' : 'product.jpg', type: current.alpha ? 'image/png' : 'image/jpeg' });
      const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(res.png)));
      if (!img) throw new Error('decode');
      const out = await (await ImageManipulator.manipulate(`data:image/png;base64,${img.encodeToBase64(ImageFormat.PNG)}`).renderAsync()).saveAsync({ format: SaveFormat.PNG });
      push({ uri: out.uri, w: out.width, h: out.height, alpha: true });
      const sec = (ms: number) => (ms / 1000).toFixed(1);
      const detail = res.processMs != null ? ` (المعالجة ${sec(res.processMs)} ث${res.queueMs ? `، الانتظار ${sec(res.queueMs)} ث` : ''})` : '';
      toast.success(`تمت الإزالة في ${sec(Date.now() - started)} ث${detail}`);
    } catch (e) {
      const err = e as { status?: number; response?: { status?: number } };
      const status = err.status ?? err.response?.status;
      toast.error(status === 429 ? 'محاولات كثيرة، انتظر دقيقة ثم أعد المحاولة' : status === 403 ? 'لا تملك صلاحية المنتجات' : status ? 'تعذّرت إزالة الخلفية الآن، حاول بعد قليل' : 'تحقق من الاتصال بالإنترنت ثم أعد المحاولة');
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  };

  const undo = () => {
    if (stack.length > 1) setStack((p) => p.slice(0, -1));
    else setAdjust(NEUTRAL);
  };
  const reset = () => {
    setStack((p) => p.slice(0, 1));
    setAdjust(NEUTRAL);
  };
  const canUndo = stack.length > 1 || !isNeutral(adjust);

  const save = async () => {
    if (!current || !image || busy) return;
    if (isNeutral(adjust) && !current.alpha) return close(stack.length > 1 ? current.uri : null);
    setBusy(true);
    try {
      const surface = Skia.Surface.MakeOffscreen(current.w, current.h);
      if (!surface) throw new Error('surface');
      const canvas = surface.getCanvas();
      // بعد الإزالة: لون الخلفية المختار ثم المنتج بظله (الشفاف يبقى PNG)
      const transparent = !!current.alpha && !bg;
      if (current.alpha && bg) canvas.drawColor(Skia.Color(bg));
      const paint = Skia.Paint();
      paint.setColorFilter(Skia.ColorFilter.MakeMatrix(toMatrix(adjust)));
      if (current.alpha && shadow) {
        const sh = shadowFor(current.h);
        paint.setImageFilter(Skia.ImageFilter.MakeDropShadow(0, sh.dy, sh.blur, sh.blur, Skia.Color(SHADOW_COLOR), null));
      }
      canvas.drawImage(image, 0, 0, paint);
      surface.flush();
      const mime = transparent ? 'png' : 'jpeg';
      const b64 = surface.makeImageSnapshot().encodeToBase64(transparent ? ImageFormat.PNG : ImageFormat.JPEG, 92);
      const r = await (await ImageManipulator.manipulate(`data:image/${mime};base64,${b64}`).renderAsync()).saveAsync(saveOpts(transparent));
      close(r.uri);
    } catch {
      toast.error('تعذّر حفظ التعديلات');
      setBusy(false);
    }
  };

  const matrix = useMemo(() => toMatrix(showOriginal ? NEUTRAL : adjust), [adjust, showOriginal]);

  // مستطيل رسم الصورة: أثناء القص حسب سحبها وتكبيرها، وإلا داخل الإطار بنسبتها (contain)
  const drawRect = useMemo((): Rect | null => {
    if (!current || !box.w || !box.h) return null;
    if (cv) return { x: cv.cx - (current.w * cv.s) / 2, y: cv.cy - (current.h * cv.s) / 2, w: current.w * cv.s, h: current.h * cv.s };
    const k = Math.min(box.w / current.w, box.h / current.h);
    const w = current.w * k;
    const h = current.h * k;
    return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h };
  }, [current, box, cv]);

  // left المنطقي ينعكس في الواجهة العربية؛ نحوّل الإحداثي الفعلي إلى ما يلزم للموضع المطلق
  const px = (x: number, w: number) => (I18nManager.isRTL ? box.w - x - w : x);

  const setKey = (key: keyof Adjust, v: number) => setAdjust((a) => ({ ...a, [key]: clamp(Math.round(v), -100, 100) }));

  const rows: { key: keyof Adjust; label: string }[] = [
    { key: 'brightness', label: 'السطوع' },
    { key: 'contrast', label: 'التباين' },
    { key: 'saturation', label: 'الألوان' },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => close(null)} hitSlop={10} accessibilityLabel="إغلاق دون تعديل">
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <AppText weight="extraBold" style={{ fontSize: 18, flex: 1 }}>تعديل الصورة</AppText>
        <Pressable onPress={undo} disabled={!canUndo || busy} hitSlop={8} accessibilityLabel="تراجع" style={{ opacity: canUndo && !busy ? 1 : 0.35 }}>
          <Ionicons name="arrow-undo-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={reset} disabled={!canUndo || busy} hitSlop={8} accessibilityLabel="الصورة الأصلية" style={{ opacity: canUndo && !busy ? 1 : 0.35 }}>
          <Ionicons name="refresh-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.preview} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {image && drawRect ? (
          <Canvas style={{ width: box.w, height: box.h }}>
            {current?.alpha && bg && !showOriginal && <SkRect x={drawRect.x} y={drawRect.y} width={drawRect.w} height={drawRect.h} color={bg} />}
            <SkImage image={image} x={drawRect.x} y={drawRect.y} width={drawRect.w} height={drawRect.h} fit="fill">
              <ColorMatrix matrix={matrix} />
              {current?.alpha && shadow && !showOriginal && <Shadow dx={0} dy={shadowFor(drawRect.h).dy} blur={shadowFor(drawRect.h).blur} color={SHADOW_COLOR} />}
            </SkImage>
          </Canvas>
        ) : null}
        {cv && (
          <>
            {/* طبقة السحب والتكبير تغطي الصندوق كله */}
            <View {...imagePan.panHandlers} style={{ position: 'absolute', left: 0, top: 0, width: box.w, height: box.h }} />
            {[
              { x: 0, y: 0, w: box.w, h: cv.frame.y },
              { x: 0, y: cv.frame.y + cv.frame.h, w: box.w, h: box.h - cv.frame.y - cv.frame.h },
              { x: 0, y: cv.frame.y, w: cv.frame.x, h: cv.frame.h },
              { x: cv.frame.x + cv.frame.w, y: cv.frame.y, w: box.w - cv.frame.x - cv.frame.w, h: cv.frame.h },
            ].map((d) => (drawRect ? intersect(d, drawRect) : d)).map((d, i) => (
              <View key={i} pointerEvents="none" style={{ position: 'absolute', left: px(d.x, d.w), top: d.y, width: Math.max(0, d.w), height: Math.max(0, d.h), backgroundColor: 'rgba(0,0,0,0.5)' }} />
            ))}
            <View pointerEvents="none" style={{ position: 'absolute', left: px(cv.frame.x, cv.frame.w), top: cv.frame.y, width: cv.frame.w, height: cv.frame.h, borderWidth: 2, borderColor: '#FFFFFF' }}>
              {/* خطوط الأثلاث تساعد على التوسيط */}
              <View style={[styles.gridV, { start: '33.3%' }]} />
              <View style={[styles.gridV, { start: '66.6%' }]} />
              <View style={[styles.gridH, { top: '33.3%' }]} />
              <View style={[styles.gridH, { top: '66.6%' }]} />
            </View>
            {ratioKey === 'free' &&
              (['tl', 'tr', 'bl', 'br'] as const).map((h) => {
                const cx = h === 'tl' || h === 'bl' ? cv.frame.x : cv.frame.x + cv.frame.w;
                const cy = h === 'tl' || h === 'tr' ? cv.frame.y : cv.frame.y + cv.frame.h;
                return (
                  <View key={h} {...corners[h].panHandlers} style={{ position: 'absolute', left: px(cx - 22, 44), top: cy - 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={styles.knob} />
                  </View>
                );
              })}
          </>
        )}
        {cv && (
          <View pointerEvents="none" style={styles.hintWrap}>
            <AppText style={styles.hint}>حرّك الصورة بإصبع وكبّرها بإصبعين</AppText>
          </View>
        )}
        {busy && (
          <View style={styles.busy} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" />
            {busyLabel && <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 14 }}>{busyLabel}</AppText>}
          </View>
        )}
        {!cv && (
          <Pressable onPressIn={() => setShowOriginal(true)} onPressOut={() => setShowOriginal(false)} style={styles.compare} accessibilityLabel="اضغط مطولاً لرؤية الأصلية">
            <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
            <AppText style={{ color: '#FFFFFF', fontSize: 12 }}>اضغط مطولاً للمقارنة</AppText>
          </Pressable>
        )}
      </View>

      <View style={styles.tabs}>
        {([['crop', 'crop-outline', 'قص'], ['enhance', 'sparkles-outline', 'تحسين'], ['background', 'color-wand-outline', 'الخلفية']] as const).map(([k, icon, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
            <Ionicons name={icon} size={18} color={tab === k ? colors.primary : colors.textMuted} />
            <AppText weight="bold" style={{ fontSize: 13, color: tab === k ? colors.primary : colors.textMuted }}>{label}</AppText>
          </Pressable>
        ))}
      </View>

      <View style={styles.panel}>
        {tab === 'crop' ? (
          <>
            <View style={styles.chips}>
              {RATIOS.map((r) => (
                <Pressable key={r.key} onPress={() => pickRatio(r.key)} disabled={busy} style={[styles.chip, ratioKey === r.key && styles.chipOn]}>
                  <AppText weight="bold" style={{ fontSize: 13, color: ratioKey === r.key ? '#FFFFFF' : colors.text }}>{r.label}</AppText>
                </Pressable>
              ))}
              <Pressable onPress={rotate} disabled={busy} style={styles.chip} accessibilityLabel="تدوير 90 درجة">
                <Ionicons name="refresh-outline" size={18} color={colors.text} />
                <AppText weight="bold" style={{ fontSize: 13 }}>تدوير</AppText>
              </Pressable>
            </View>
            <Pressable onPress={applyCrop} disabled={busy || !cv} style={[styles.auto, { opacity: busy || !cv ? 0.5 : 1 }]}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 14 }}>تطبيق القص</AppText>
            </Pressable>
          </>
        ) : tab === 'background' ? (
          current?.alpha ? (
            <>
              <View style={styles.chips}>
                {BACKGROUNDS.map((b) => {
                  const on = bg === b.color;
                  return (
                    <Pressable key={b.label} onPress={() => setBg(b.color)} style={[styles.chip, on && { borderColor: colors.primary, borderWidth: 2 }]}>
                      <View style={[styles.swatch, b.color ? { backgroundColor: b.color } : styles.swatchClear]} />
                      <AppText weight="bold" style={{ fontSize: 13 }}>{b.label}</AppText>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => setShadow((v) => !v)} style={[styles.chip, shadow && styles.chipOn]}>
                  <Ionicons name="sunny-outline" size={17} color={shadow ? '#FFFFFF' : colors.text} />
                  <AppText weight="bold" style={{ fontSize: 13, color: shadow ? '#FFFFFF' : colors.text }}>ظل</AppText>
                </Pressable>
              </View>
              <AppText muted style={{ fontSize: 12, textAlign: 'center' }}>للرجوع للخلفية الأصلية اضغط «تراجع» أعلى الشاشة</AppText>
            </>
          ) : (
            <>
              <Pressable onPress={removeBackground} disabled={busy || !vendorId} style={[styles.auto, { opacity: busy || !vendorId ? 0.5 : 1 }]}>
                <Ionicons name="color-wand" size={18} color="#FFFFFF" />
                <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 14 }}>إزالة الخلفية</AppText>
              </Pressable>
              <AppText muted style={{ fontSize: 12, textAlign: 'center' }}>تُرسل الصورة للخادم وتعود بلا خلفية خلال ثوانٍ، ثم تختار لون الخلفية والظل. تحتاج اتصالاً بالإنترنت.</AppText>
            </>
          )
        ) : (
          <>
            <Pressable onPress={() => setAdjust(AUTO)} style={styles.auto}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 14 }}>تحسين تلقائي</AppText>
            </Pressable>
            {rows.map((r) => (
              <View key={r.key} style={styles.adjRow}>
                <AppText weight="medium" style={{ width: 52, fontSize: 13 }}>{r.label}</AppText>
                <Pressable onPress={() => setKey(r.key, adjust[r.key] - 5)} style={styles.stepBtn} hitSlop={6}><Ionicons name="remove" size={18} color={colors.text} /></Pressable>
                <Slider value={adjust[r.key]} onChange={(v) => setKey(r.key, v)} />
                <Pressable onPress={() => setKey(r.key, adjust[r.key] + 5)} style={styles.stepBtn} hitSlop={6}><Ionicons name="add" size={18} color={colors.text} /></Pressable>
                <AppText weight="bold" style={{ width: 34, textAlign: 'center', fontSize: 13 }}>{adjust[r.key]}</AppText>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable onPress={() => close(null)} style={[styles.footBtn, styles.skip]}>
          <AppText weight="bold" style={{ fontSize: 15 }}>تخطّي</AppText>
        </Pressable>
        <Pressable onPress={save} disabled={busy || !current} style={[styles.footBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}>
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          <AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 15 }}>حفظ</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12 },
  preview: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  busy: { ...({ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 } as const), alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.35)' },
  compare: { position: 'absolute', bottom: 10, start: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  panel: { paddingHorizontal: 16, paddingTop: 10, gap: 8, justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  auto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 22, backgroundColor: colors.primary },
  hintWrap: { position: 'absolute', bottom: 8, start: 0, end: 0, alignItems: 'center' },
  hint: { color: '#FFFFFF', fontSize: 11.5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  gridH: { position: 'absolute', start: 0, end: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.border },
  swatchClear: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: colors.primary },
  adjRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  thumb: { position: 'absolute', top: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, borderWidth: 3, borderColor: '#FFFFFF', elevation: 3 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 10, padding: 16 },
  footBtn: { flex: 1, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  skip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
}));
