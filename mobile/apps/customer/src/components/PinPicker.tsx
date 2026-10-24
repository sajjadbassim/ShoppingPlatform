import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { AppText, colors, radius, createStyles, tc, useTheme } from '@wasit/ui';

export interface Pin {
  latitude: number;
  longitude: number;
}

interface Props {
  value: Pin | null;
  onChange: (pin: Pin) => void;
  error?: string;
  height?: number;
  // يُبلَّغ بلمس الخريطة ليوقف الأب تمرير الصفحة أثناء تحريك الخريطة
  onTouching?: (touching: boolean) => void;
}

const KUT: [number, number] = [32.5128, 45.8182]; // مركز افتراضي: الكوت (كما في الويب)
const PRECISE_ZOOM = 16; // أقل من هذا = الدبوس غير دقيق بما يكفي لباب منزل

// نفس فكرة الويب (LocationPicker): الدبوس ثابت في المنتصف والزبون يحرّك الخريطة تحته.
// Leaflet + OpenStreetMap داخل WebView: لا يحتاج مفتاح Google ولا development build
const buildHtml = (center: [number, number], zoom: number, touched: boolean) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#m{margin:0;height:100%;width:100%;background:#e5e7eb}</style></head>
<body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var touched=${touched};
var post=function(o){window.ReactNativeWebView.postMessage(JSON.stringify(o))};
var map=L.map('m',{zoomControl:false,attributionControl:false,center:[${center[0]},${center[1]}],zoom:${zoom},touchZoom:'center',doubleClickZoom:'center',scrollWheelZoom:'center'});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var report=function(){var c=map.getCenter();post({type:'move',lat:Math.round(c.lat*1e7)/1e7,lng:Math.round(c.lng*1e7)/1e7,zoom:map.getZoom(),touched:touched})};
map.on('dragstart zoomstart',function(){touched=true});
map.on('moveend',report);
var el=document.getElementById('m');
el.addEventListener('touchstart',function(){post({type:'touch',on:true})},{passive:true});
el.addEventListener('touchend',function(){post({type:'touch',on:false})},{passive:true});
el.addEventListener('touchcancel',function(){post({type:'touch',on:false})},{passive:true});
window.flyTo=function(lat,lng){touched=true;map.flyTo([lat,lng],18,{duration:0.8})};
post({type:'ready',zoom:map.getZoom()});
</script></body></html>`;

export function PinPicker({ value, onChange, error, height = 240, onTouching }: Props) {
  useTheme();
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const [zoom, setZoom] = useState(value ? 17 : 13);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // الخريطة تُبنى مرة واحدة بالموقع الأولي؛ ما بعده يتحكم به المستخدم
  const html = useMemo(
    () => buildHtml(value ? [value.latitude, value.longitude] : KUT, value ? 17 : 13, !!value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'touch') onTouching?.(!!m.on);
      else if (m.type === 'move') {
        setZoom(m.zoom);
        if (m.touched) {
          setProblem(null);
          onChange({ latitude: m.lat, longitude: m.lng });
        }
      }
    } catch {
      // رسالة غير معروفة: نتجاهلها
    }
  };

  const locate = async () => {
    setLocating(true);
    setProblem(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setProblem('لم تسمح بالوصول للموقع — حرّك الخريطة يدوياً أو فعّله من إعدادات الهاتف');
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setProblem('خدمة الموقع (GPS) مطفأة — فعّلها أو حرّك الخريطة يدوياً');
        return;
      }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      web.current?.injectJavaScript(`window.flyTo(${p.coords.latitude},${p.coords.longitude});true;`);
    } catch {
      setProblem('تعذّر تحديد موقعك — تأكد من تشغيل GPS أو حرّك الخريطة يدوياً');
    } finally {
      setLocating(false);
    }
  };

  const hasPin = !!value;

  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.mapBox, { height }, error && !hasPin ? styles.bad : hasPin ? styles.good : null]}>
        <WebView
          ref={web}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={onMessage}
          javaScriptEnabled
          nestedScrollEnabled
          overScrollMode="never"
          style={{ flex: 1 }}
        />

        {/* الدبوس الثابت: رأسه يشير لمنتصف الخريطة تماماً */}
        <View pointerEvents="none" style={styles.pinWrap}>
          <Ionicons name="location-sharp" size={44} color={hasPin ? colors.primary : tc('#374151')} />
        </View>
        <View pointerEvents="none" style={styles.pinShadow} />

        {!hasPin && (
          <View pointerEvents="none" style={styles.hint}>
            <AppText weight="medium" style={styles.hintText}>
              حرّك الخريطة ليكون الدبوس على باب منزلك
            </AppText>
          </View>
        )}

        <Pressable onPress={locate} disabled={locating} style={[styles.locate, locating && { opacity: 0.7 }]} accessibilityRole="button">
          <Ionicons name="locate" size={18} color={colors.primary} />
          <AppText weight="bold" style={{ color: colors.white, fontSize: 14 }}>
            {locating ? 'جاري التحديد...' : 'موقعي الحالي'}
          </AppText>
        </Pressable>
      </View>

      {!!problem && <AppText style={{ color: tc('#B45309'), fontSize: 12 }}>{problem}</AppText>}
      {!!error && !hasPin && <AppText style={{ color: colors.errorDark, fontSize: 12 }}>{error}</AppText>}
      {hasPin &&
        (zoom < PRECISE_ZOOM ? (
          <AppText style={{ color: tc('#B45309'), fontSize: 12 }}>قرّب الخريطة أكثر وتأكد أن الدبوس على بابك بالضبط</AppText>
        ) : (
          <AppText style={{ color: tc('#047857'), fontSize: 12 }}>تم تحديد الموقع — سيصل السائق إليه مباشرة</AppText>
        ))}
    </View>
  );
}

const styles = createStyles(() => ({
  mapBox: { borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: colors.border, backgroundColor: '#E5E7EB' },
  good: { borderColor: '#4ADE80' },
  bad: { borderColor: '#F87171' },
  pinWrap: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: -44, alignItems: 'center' },
  pinShadow: { position: 'absolute', left: '50%', top: '50%', marginLeft: -4, width: 8, height: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.3)' },
  hint: { position: 'absolute', top: 8, left: 8, right: 8, alignItems: 'center' },
  hintText: { backgroundColor: 'rgba(17,24,39,0.8)', color: colors.white, fontSize: 12, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
  locate: { position: 'absolute', bottom: 12, end: 12, height: 40, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
