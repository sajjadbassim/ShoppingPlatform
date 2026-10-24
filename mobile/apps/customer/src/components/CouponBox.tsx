import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@wasit/shared';
import { AppText, colors, fonts, createStyles, tc, useTheme } from '@wasit/ui';
import type { CouponState } from '../api/useCoupon';

interface Props {
  coupon: CouponState;
  // يعرض مبلغ الخصم تحت الكود ويزيل بأيقونة ×، كما في إتمام الطلب (وفي السلة زر «إزالة» نصي)
  compact?: boolean;
}

// كود الخصم: مطوي خلف «لديك كود خصم؟» حتى يُطلب (كما في السلة وإتمام الطلب في الويب)
export function CouponBox({ coupon, compact }: Props) {
  useTheme();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');

  if (coupon.applied) {
    return (
      <View style={styles.applied}>
        <View style={styles.appliedInfo}>
          <Ionicons name="pricetag-outline" size={16} color={tc("#15803D")} />
          <View>
            <AppText weight="medium" style={styles.appliedCode}>
              {coupon.applied.code}
            </AppText>
            {compact && (
              <AppText style={styles.appliedAmount}>خصم {formatPrice(coupon.discount)}</AppText>
            )}
          </View>
        </View>
        <Pressable onPress={coupon.remove} hitSlop={8} accessibilityLabel="إزالة الكوبون">
          {compact ? (
            <Ionicons name="close" size={18} color={colors.placeholder} />
          ) : (
            <AppText style={styles.remove}>إزالة</AppText>
          )}
        </Pressable>
      </View>
    );
  }

  if (!open) {
    return (
      <Pressable style={styles.link} onPress={() => setOpen(true)}>
        <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
        <AppText weight="medium" style={styles.linkText}>
          لديك كود خصم؟
        </AppText>
      </Pressable>
    );
  }

  const submit = () => coupon.apply(code);

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.inputRow}>
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(t);
            coupon.setError('');
          }}
          onSubmitEditing={submit}
          placeholder="أدخل كود الخصم"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="characters"
          autoFocus
          style={styles.input}
        />
        <Pressable style={[styles.apply, (!code.trim() || coupon.busy) && styles.applyOff]} disabled={!code.trim() || coupon.busy} onPress={submit}>
          {coupon.busy ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <AppText weight="medium" style={styles.applyText}>
              تطبيق
            </AppText>
          )}
        </Pressable>
      </View>
      {!!coupon.error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
          <AppText style={styles.errorText}>{coupon.error}</AppText>
        </View>
      )}
    </View>
  );
}

const styles = createStyles(() => ({
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  linkText: { color: colors.primary, fontSize: 14 },
  applied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  appliedInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appliedCode: { color: '#15803D', fontSize: 14 },
  appliedAmount: { color: '#16A34A', fontSize: 12 },
  remove: { color: colors.error, fontSize: 14 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: 'right',
  },
  apply: { height: 40, minWidth: 64, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  applyOff: { backgroundColor: '#D1D5DB' },
  applyText: { color: colors.white, fontSize: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorText: { color: colors.error, fontSize: 12 },
}));
