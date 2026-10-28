import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatClock, formatDate, type DriverOrder } from '@wasit/shared';
import { AppText, brand, colors, createStyles, radius, useTheme } from '@wasit/ui';
import { callPhone, openNavigation } from './kit';

const MAP_HEIGHT = 150;

// نقاط المسار من المتجر (يمين، كعمود «من») إلى الزبون (يسار، كعمود «إلى») كنسب من عرض الخريطة وارتفاعها
const ROUTE: [number, number][] = [
  [0.88, 0.46],
  [0.88, 0.7],
  [0.64, 0.7],
  [0.5, 0.44],
  [0.36, 0.7],
  [0.14, 0.7],
  [0.14, 0.52],
];

function Segment({ a, b, color, thickness, opacity = 1 }: { a: [number, number]; b: [number, number]; color: string; thickness: number; opacity?: number }) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return (
    <View
      style={{
        position: 'absolute',
        left: (a[0] + b[0]) / 2 - length / 2,
        top: (a[1] + b[1]) / 2 - thickness / 2,
        width: length,
        height: thickness,
        borderRadius: thickness,
        backgroundColor: color,
        opacity,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

// خريطة مسار تخطيطية (ليست خريطة حقيقية): شوارع خافتة ومسار من المتجر إلى الزبون، الجزء المقطوع بلون هادئ والباقي برتقالي
function RouteMap({ traveledSegments }: { traveledSegments: number }) {
  const [width, setWidth] = useState(0);
  const pts = ROUTE.map(([x, y]) => [x * width, y * MAP_HEIGHT] as [number, number]);
  const streets: { a: [number, number]; b: [number, number] }[] = [
    { a: [0, 0.2 * MAP_HEIGHT], b: [width, 0.12 * MAP_HEIGHT] },
    { a: [0, 0.82 * MAP_HEIGHT], b: [width, 0.9 * MAP_HEIGHT] },
    { a: [0.28 * width, 0], b: [0.22 * width, MAP_HEIGHT] },
    { a: [0.5 * width, 0], b: [0.58 * width, MAP_HEIGHT] },
    { a: [0.76 * width, 0], b: [0.74 * width, MAP_HEIGHT] },
    { a: [0, 0.5 * MAP_HEIGHT], b: [width, 0.46 * MAP_HEIGHT] },
  ];
  const origin = pts[0];
  const dest = pts[pts.length - 1];

  return (
    <View style={styles.map} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          {streets.map((s, i) => <Segment key={`s${i}`} a={s.a} b={s.b} color={colors.border} thickness={i < 2 ? 7 : 4} opacity={0.9} />)}
          {pts.slice(1).map((p, i) => (
            <Segment key={`r${i}`} a={pts[i]} b={p} color={i < traveledSegments ? colors.textMuted : colors.primary} thickness={4} opacity={i < traveledSegments ? 0.6 : 1} />
          ))}
          <View style={[styles.originMarker, { left: origin[0] - 13, top: origin[1] - 13 }]}>
            <Ionicons name="storefront" size={13} color={colors.primary} />
          </View>
          <View style={[styles.destHalo, { left: dest[0] - 20, top: dest[1] - 20 }]} />
          <View style={[styles.destMarker, { left: dest[0] - 13, top: dest[1] - 13 }]}>
            <Ionicons name="home" size={13} color={colors.white} />
          </View>
        </>
      )}
    </View>
  );
}

const statusOf = (o: DriverOrder) =>
  o.status === 'DELIVERED'
    ? { label: 'سُلّم', bg: colors.success, fg: '#06281E' }
    : o.status === 'DELIVERY_FAILED'
      ? { label: 'تعذّر التسليم', bg: colors.error, fg: '#FFFFFF' }
      : o.allPickedUp
        ? { label: 'في الطريق', bg: colors.primary, fg: '#FFFFFF' }
        : { label: 'بانتظار الاستلام', bg: colors.warning, fg: '#3B2A00' };

function Place({ label, title, lines }: { label: string; title: string; lines: string }) {
  return (
    <View style={styles.col}>
      <AppText muted style={{ fontSize: 12 }}>{label}</AppText>
      <AppText weight="bold" numberOfLines={2} style={{ fontSize: 14 }}>{title}</AppText>
      {!!lines && <AppText muted numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 19 }}>{lines}</AppText>}
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.col}>
      <AppText muted style={{ fontSize: 12 }}>{label}</AppText>
      <AppText weight="medium" style={{ fontSize: 14 }}>{value}</AppText>
    </View>
  );
}

function RoundButton({ icon, onPress, label, primary }: { icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; label: string; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.round, primary && { backgroundColor: colors.primary, borderColor: colors.primary }, pressed && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={18} color={primary ? colors.white : colors.primary} />
    </Pressable>
  );
}

// رأس تفاصيل الطلب: مسار، رقم الطلب، من/إلى، التواريخ، وتواصل سريع مع الزبون
export function OrderHero({ order }: { order: DriverOrder }) {
  useTheme();
  const status = statusOf(order);
  const finished = order.status === 'DELIVERED' || order.status === 'DELIVERY_FAILED';
  const first = order.stores[0];
  const extra = order.stores.length - 1;
  const traveled = finished ? ROUTE.length - 1 : order.allPickedUp ? 3 : 0;
  const to = [order.zoneName, order.address].filter(Boolean).join('، ');
  const initial = order.customerName.trim().charAt(0);

  return (
    <View style={styles.card}>
      <View>
        <RouteMap traveledSegments={traveled} />
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <AppText weight="bold" style={{ fontSize: 12, color: status.fg }}>{status.label}</AppText>
        </View>
      </View>

      <View style={styles.idBlock}>
        <AppText muted style={{ fontSize: 12.5 }}>رقم الطلب</AppText>
        <AppText weight="extraBold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 22, writingDirection: 'ltr' }}>{order.orderNumber}</AppText>
      </View>

      <View style={styles.divider} />
      <View style={styles.cols}>
        <Place label="من" title={first?.vendorName ?? '—'} lines={extra > 0 ? `+${extra} ${extra === 1 ? 'متجر آخر' : 'متاجر أخرى'}` : first?.vendorAddress ?? ''} />
        <Place label="إلى" title={order.customerName} lines={to} />
      </View>

      <View style={styles.divider} />
      <View style={styles.cols}>
        <Meta label="تاريخ الإسناد" value={`${formatDate(order.assignedAt)} · ${formatClock(order.assignedAt)}`} />
        {order.status === 'DELIVERED' && order.deliveredAt ? (
          <Meta label="وقت التسليم" value={`${formatDate(order.deliveredAt)} · ${formatClock(order.deliveredAt)}`} />
        ) : order.deliverySlotStart ? (
          <Meta label="موعد التسليم" value={`${formatClock(order.deliverySlotStart)} – ${formatClock(order.deliverySlotEnd)}`} />
        ) : (
          <Meta label="موعد التسليم" value="غير محدد" />
        )}
      </View>

      <View style={styles.divider} />
      <View style={styles.contact}>
        <View style={styles.avatar}>
          <AppText weight="extraBold" style={{ fontSize: 16, color: colors.primary }}>{initial}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText muted style={{ fontSize: 12 }}>الزبون</AppText>
          <AppText weight="bold" numberOfLines={1} style={{ fontSize: 14.5 }}>{order.customerName}</AppText>
        </View>
        <RoundButton icon="navigate" label="ملاحة" onPress={() => openNavigation(order)} />
        {!!order.customerPhone && <RoundButton icon="chatbubble-ellipses" label="رسالة" onPress={() => Linking.openURL(`sms:${order.customerPhone}`)} />}
        {!!order.customerPhone && <RoundButton icon="call" label="اتصال" primary onPress={() => callPhone(order.customerPhone)} />}
      </View>
    </View>
  );
}

const styles = createStyles(() => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl + 8, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 12 },
  map: { height: MAP_HEIGHT, borderRadius: radius.xl, backgroundColor: brand.surfaceMuted, overflow: 'hidden', direction: 'ltr' },
  badge: { position: 'absolute', top: 10, end: 10, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  originMarker: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  destHalo: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, opacity: 0.22 },
  destMarker: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  idBlock: { alignItems: 'center', gap: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 6 },
  cols: { flexDirection: 'row', gap: 14, paddingHorizontal: 8 },
  col: { flex: 1, gap: 3 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
}));
