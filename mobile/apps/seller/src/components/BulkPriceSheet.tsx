import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { bulkPriceFields, type BulkPriceMode, type VendorProduct } from '@wasit/shared';
import { AppText, colors, createStyles, fonts, useTheme , tc } from '@wasit/ui';
import { ActionButton, Segmented } from './kit';
import { Sheet } from './Sheet';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// تسعير جماعي لمنتجات محددة: تغيير بنسبة، تطبيق خصم (يظهر الأصلي مشطوباً)، أو إلغاء الخصم
export function BulkPriceSheet({ products, visible, busy, onClose, onApply }: { products: VendorProduct[]; visible: boolean; busy: boolean; onClose: () => void; onApply: (mode: BulkPriceMode, percent: number) => void }) {
  useTheme();
  const [mode, setMode] = useState<BulkPriceMode>('percent');
  const [value, setValue] = useState('');
  useEffect(() => {
    if (visible) {
      setMode('percent');
      setValue('');
    }
  }, [visible]);

  const percent = Number(value.replace(',', '.')) || 0;
  const needsValue = mode !== 'clearDiscount';
  const valid = needsValue ? (mode === 'percent' ? percent !== 0 && percent > -100 : percent > 0 && percent < 100) : true;
  const preview = products.map((p) => ({ p, fields: valid ? bulkPriceFields(p, mode, percent) : null })).filter((x) => x.fields);
  const skipped = products.length - preview.length;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      busy={busy}
      title={`تعديل أسعار ${products.length} منتج`}
      subtitle="المنتجات ذات المتغيرات والبيع بالوزن يُعدَّل سعرها الأساسي كما هو."
      footer={
        <>
          <ActionButton title="إلغاء" tone="ghost" onPress={onClose} disabled={busy} />
          <ActionButton title={`تطبيق على ${preview.length}`} onPress={() => onApply(mode, percent)} disabled={!valid || preview.length === 0} loading={busy} />
        </>
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { key: 'percent', label: 'بنسبة' },
          { key: 'discount', label: 'خصم' },
          { key: 'clearDiscount', label: 'إلغاء الخصم' },
        ]}
      />
      {needsValue && (
        <View style={{ gap: 6 }}>
          <AppText weight="medium" style={{ fontSize: 14 }}>{mode === 'percent' ? 'النسبة %' : 'نسبة الخصم %'}</AppText>
          <TextInput value={value} onChangeText={setValue} keyboardType="numbers-and-punctuation" placeholder={mode === 'percent' ? '10 أو -10' : '15'} placeholderTextColor={colors.placeholder} style={styles.input} textAlign="left" />
          <AppText muted style={{ fontSize: 12.5, lineHeight: 20 }}>
            {mode === 'percent' ? 'موجب للرفع وسالب للخفض، مثل 10 أو -10.' : 'يظهر السعر الأصلي مشطوباً بجانب السعر الجديد.'}
          </AppText>
        </View>
      )}
      {mode === 'clearDiscount' && <AppText muted style={{ fontSize: 13.5, lineHeight: 22 }}>يعود السعر إلى السعر الأصلي المشطوب للمنتجات التي عليها خصم.</AppText>}
      {preview.length > 0 && (
        <View style={styles.preview}>
          <AppText weight="bold" style={{ fontSize: 13 }}>معاينة</AppText>
          {preview.slice(0, 5).map(({ p, fields }) => (
            <AppText key={p.id} style={{ fontSize: 13 }} numberOfLines={1}>
              {p.nameAr || p.name}: {fmt(p.regularPrice ?? p.price)} ← {fmt(Number(fields!.Price))} د.ع
            </AppText>
          ))}
          {preview.length > 5 && <AppText muted style={{ fontSize: 12.5 }}>و{preview.length - 5} منتجات أخرى</AppText>}
          {skipped > 0 && <AppText muted style={{ fontSize: 12.5 }}>{skipped} منتج لن يتغير (لا ينطبق عليه التعديل)</AppText>}
        </View>
      )}
    </Sheet>
  );
}

const styles = createStyles(() => ({
  input: { minHeight: 52, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14, fontFamily: fonts.bold, fontSize: 18, color: colors.text, writingDirection: 'ltr' },
  preview: { backgroundColor: tc('#F8ECDA'), borderRadius: 16, padding: 12, gap: 4 },
}));
