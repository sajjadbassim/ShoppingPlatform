import { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FAIL_REASONS, type DriverOrder, type FailPayload } from '@wasit/shared';
import { AppText, Checkbox, colors, createStyles, fonts, radius, useTheme } from '@wasit/ui';
import { ActionButton, money } from './kit';

interface Props {
  order: DriverOrder | null;
  initialReason?: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: FailPayload) => void;
}

// تعذّر التسليم: السبب إلزامي، والملاحظة إلزامية عند «سبب آخر»
export function FailSheet({ order, initialReason, loading, onClose, onConfirm }: Props) {
  useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [feeCollected, setFeeCollected] = useState(false);

  useEffect(() => {
    setReason(initialReason ?? '');
    setNote('');
    setFeeCollected(false);
  }, [order?.orderId, initialReason]);

  if (!order) return null;

  // أجرة التوصيل تُحصَّل من الزبون الرافض فقط حين يتحمّلها
  const customerPays = reason === 'customer_refused' && order.refusalFeePayer === 'CUSTOMER' && order.deliveryFee > 0;
  const needsNote = reason === 'other' && !note.trim();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <AppText weight="extraBold" style={{ fontSize: 18 }}>تعذّر التسليم</AppText>
        <View style={styles.grid}>
          {FAIL_REASONS.map((r) => (
            <Pressable key={r.value} onPress={() => setReason(r.value)} style={[styles.reason, reason === r.value && styles.reasonOn]}>
              <AppText weight="bold" style={{ fontSize: 14, color: reason === r.value ? colors.white : colors.text }}>{r.label}</AppText>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={300}
          multiline
          placeholder={reason === 'other' ? 'اكتب السبب (مطلوب)' : 'ملاحظة للعمليات (اختياري)'}
          placeholderTextColor={colors.placeholder}
          style={styles.note}
        />
        {customerPays && (
          <Checkbox checked={feeCollected} onChange={setFeeCollected} label={`استلمت أجرة التوصيل (${money(order.deliveryFee)}) من الزبون`} />
        )}
        <ActionButton title="تأكيد: تعذّر التسليم" tone="bad" loading={loading} disabled={!reason || needsNote} onPress={() => onConfirm({ reason, note: note.trim() || undefined, feeCollected: customerPays && feeCollected })} />
        <ActionButton title="رجوع" tone="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = createStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reason: { width: '48%', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: 12 },
  reasonOn: { backgroundColor: '#EA580C', borderColor: '#EA580C' },
  note: { minHeight: 70, textAlignVertical: 'top', textAlign: 'right', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 10, fontFamily: fonts.regular, color: colors.text },
}));
