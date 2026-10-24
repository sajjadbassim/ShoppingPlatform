import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { REJECT_REASONS, type VendorOrder } from '@wasit/shared';
import { AppText, colors, createStyles, fonts, useTheme } from '@wasit/ui';
import { ActionButton } from './kit';
import { Sheet } from './Sheet';

// سبب الرفض مطلوب من الخادم ويصل للزبون
export function RejectSheet({ order, busy, onClose, onSubmit }: { order: Pick<VendorOrder, 'subOrderNumber'> | null; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  useTheme();
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  useEffect(() => {
    if (order) {
      setReason('');
      setCustom('');
    }
  }, [order]);
  const final = reason === 'other' ? custom.trim() : reason;
  return (
    <Sheet
      visible={!!order}
      onClose={onClose}
      busy={busy}
      title="لماذا ترفض الطلب؟"
      subtitle={order ? `الطلب ${order.subOrderNumber}. السبب يظهر للزبون، والرفض المتكرر يؤثر على تقييم متجرك.` : undefined}
      footer={
        <>
          <ActionButton title="رجوع" tone="ghost" onPress={onClose} disabled={busy} />
          <ActionButton title="تأكيد الرفض" tone="bad" onPress={() => onSubmit(final)} disabled={!final} loading={busy} />
        </>
      }
    >
      {[...REJECT_REASONS, 'other'].map((r) => {
        const on = reason === r;
        return (
          <Pressable key={r} onPress={() => setReason(r)} style={[styles.option, on && styles.optionOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
            <View style={[styles.radio, on && { borderColor: colors.primary }]}>{on && <View style={styles.dot} />}</View>
            <AppText weight={on ? 'bold' : 'regular'} style={{ flex: 1, fontSize: 15 }}>{r === 'other' ? 'سبب آخر' : r}</AppText>
          </Pressable>
        );
      })}
      {reason === 'other' && <TextInput value={custom} onChangeText={setCustom} multiline maxLength={300} placeholder="اكتب السبب..." placeholderTextColor={colors.placeholder} style={styles.input} textAlign="right" />}
    </Sheet>
  );
}

const styles = createStyles(() => ({
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CDB89B', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  input: { minHeight: 80, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.text, textAlignVertical: 'top' },
}));
