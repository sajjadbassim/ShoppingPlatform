import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { formatClock, formatDecisionCountdown, getImageUrl, itemTitle, nextOrderStep, orderPieces, orderTotal, ORDER_STATUS_LABELS, secondsLeft, type VendorOrder } from '@wasit/shared';
import { AppText, createStyles, useTheme , tc } from '@wasit/ui';
import { ActionButton, Card, Chip, ltr, money } from './kit';
import { palette } from '../lib/palette';

export const useNow = (ms = 1000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
};

// الوقت المتبقي لقرار القبول: بعد انتهائه يظهر الطلب متأخراً للعمليات (لا يُلغى تلقائياً)
export function Countdown({ deadline }: { deadline?: string | null }) {
  useTheme();
  const now = useNow();
  const left = secondsLeft(deadline, now);
  if (left == null) return null;
  return <Chip label={`⏱ ${formatDecisionCountdown(left)}`} tone={left < 60 ? 'bad' : 'warn'} />;
}

export const timeAgo = (iso: string): string => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `منذ ${min} د`;
  const h = Math.round(min / 60);
  if (h < 24) return `منذ ${h} س`;
  return formatClock(iso) ? new Date(iso).toLocaleDateString('ar-IQ-u-nu-latn', { day: 'numeric', month: 'short' }) : '';
};

const STATUS_TONE: Record<string, 'primary' | 'ok' | 'warn' | 'bad' | 'muted'> = {
  PENDING_CONFIRMATION: 'warn',
  CONFIRMED: 'primary',
  PREPARING: 'primary',
  READY: 'ok',
  OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'ok',
  DELIVERY_FAILED: 'bad',
  CANCELLED: 'muted',
};

export const statusTone = (s: string) => STATUS_TONE[s] ?? 'muted';

interface Props {
  order: VendorOrder;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onAdvance: (step: 'preparing' | 'ready') => void;
}

export function OrderCard({ order, busy, onAccept, onReject, onAdvance }: Props) {
  useTheme();
  const pending = order.status === 'PENDING_CONFIRMATION';
  const next = nextOrderStep(order.status);
  const names = order.items.map(itemTitle).join('، ');
  return (
    <Card tone={pending ? 'warn' : undefined} onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.subOrderId } })}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppText weight="extraBold" style={{ fontSize: 15, writingDirection: 'ltr', textAlign: 'right' }}>{order.subOrderNumber}</AppText>
          <AppText muted style={{ fontSize: 12 }}>{timeAgo(order.createdAt)}</AppText>
        </View>
        {pending && <Countdown deadline={order.confirmationDeadline} />}
        <Chip label={ORDER_STATUS_LABELS[order.status] ?? order.status} tone={statusTone(order.status)} />
      </View>
      <View style={styles.row}>
        <View style={styles.thumbs}>
          {order.items.slice(0, 3).map((it, i) => (
            <View key={it.id ?? i} style={styles.thumb}>{it.productImageUrl ? <Image source={{ uri: getImageUrl(it.productImageUrl, 200) ?? undefined }} style={{ flex: 1 }} contentFit="cover" /> : null}</View>
          ))}
          {order.items.length > 3 && (
            <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
              <AppText weight="bold" muted style={{ fontSize: 12 }}>{ltr(`+${order.items.length - 3}`)}</AppText>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontSize: 14 }} numberOfLines={1}>{names || '—'}</AppText>
          <AppText muted style={{ fontSize: 12.5 }} numberOfLines={1}>{orderPieces(order)} قطعة · {order.customerName}</AppText>
          {!!order.customerNotes && <AppText style={{ fontSize: 12, color: palette.warnText }} numberOfLines={1}>ملاحظة: {order.customerNotes}</AppText>}
        </View>
        <AppText weight="extraBold" style={{ fontSize: 15 }}>{money(orderTotal(order))}</AppText>
      </View>
      {pending && (
        <View style={styles.row}>
          <ActionButton title="رفض" tone="bad" onPress={onReject} disabled={busy} compact />
          <View style={{ flex: 2 }}>
            <View style={{ flexDirection: 'row' }}>
              <ActionButton title="قبول الطلب" icon="checkmark" onPress={onAccept} loading={busy} compact />
            </View>
          </View>
        </View>
      )}
      {!pending && next && (
        <View style={{ flexDirection: 'row' }}>
          <ActionButton title={next.label} tone={next.step === 'ready' ? 'ok' : 'primary'} onPress={() => onAdvance(next.step)} loading={busy} compact />
        </View>
      )}
      {order.status === 'READY' && <AppText weight="bold" style={{ color: palette.okText, textAlign: 'center', fontSize: 13 }}>جاهز، بانتظار وصول السائق</AppText>}
    </Card>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumbs: { flexDirection: 'row' },
  thumb: { width: 40, height: 40, borderRadius: 11, backgroundColor: tc('#F8ECDA'), overflow: 'hidden', marginEnd: -10, borderWidth: 2, borderColor: '#FFFFFF' },
}));
