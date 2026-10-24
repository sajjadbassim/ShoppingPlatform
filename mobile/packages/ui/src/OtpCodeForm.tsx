import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { isValidOtp, type ApiError } from '@wasit/shared';
import { AppText } from './AppText';
import { Button } from './Button';
import { Input } from './Input';
import { colors, radius, spacing, createStyles, tc, useTheme } from './theme';

const RESEND_SECONDS = 60;

interface Props {
  phone: string;
  // رمز التجربة (بيئة التطوير فقط): الخادم يعيده لأن واتساب التجريبي لا يرسل رسالة حقيقية
  initialDevCode?: string;
  submitText: string;
  onVerify: (code: string) => Promise<void>;
  // يعيد إرسال الرمز ويعيد devCode الجديد
  onResend: () => Promise<string>;
  onChangePhone?: () => void;
  // شاشة استعادة كلمة المرور: بلا جملة الشرح ولا إعادة الإرسال، ونص «تغيير رقم الهاتف» في الوسط
  compact?: boolean;
}

// إدخال رمز من 6 أرقام مع عدّاد إعادة الإرسال — يخدم تأكيد الهاتف في التسجيل واستعادة كلمة المرور
export function OtpCodeForm({ phone, initialDevCode = '', submitText, onVerify, onResend, onChangePhone, compact }: Props) {
  useTheme();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(initialDevCode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = async () => {
    if (!isValidOtp(code)) {
      setError('أدخل الرمز المكوّن من 6 أرقام');
      return;
    }
    setBusy(true);
    try {
      await onVerify(code);
    } catch (e) {
      setError((e as ApiError).message || 'رمز التحقق غير صحيح');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      setDevCode(await onResend());
      setCode('');
      setWait(RESEND_SECONDS);
    } catch (e) {
      setError((e as ApiError).message || 'تعذّر إرسال الرمز');
    }
  };

  return (
    <View style={styles.container}>
      {!compact && (
      <AppText muted style={styles.hint}>
        أرسلنا رمزاً من 6 أرقام إلى واتساب على الرقم{' '}
        <AppText weight="bold" style={[styles.hint, { color: colors.text }]}>
          {phone}
        </AppText>
      </AppText>
      )}

      {!!devCode && (
        <Pressable
          style={styles.dev}
          onPress={() => {
            setCode(devCode);
            setError('');
          }}
        >
          <AppText style={styles.devText}>
            رمز التجربة (التطوير فقط):{' '}
            <AppText weight="bold" style={[styles.devText, { color: tc('#B45309') }]}>
              {devCode}
            </AppText>
          </AppText>
          <AppText weight="medium" style={[styles.devText, { color: colors.primary, textDecorationLine: 'underline' }]}>
            استخدمه
          </AppText>
        </Pressable>
      )}

      <Input
        label="رمز التحقق"
        icon="key-outline"
        value={code}
        onChangeText={(t) => {
          setCode(t.replace(/\D/g, '').slice(0, 6));
          setError('');
        }}
        error={error}
        placeholder="000000"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        maxLength={6}
        ltr
      />

      <Button title={submitText} loading={busy} onPress={verify} />

      <View style={[styles.row, compact && { justifyContent: 'center' }]}>
        {onChangePhone ? (
          <Pressable onPress={onChangePhone} hitSlop={8}>
            <AppText muted style={styles.small}>
              {compact ? 'تغيير رقم الهاتف' : 'تغيير الرقم'}
            </AppText>
          </Pressable>
        ) : (
          <View />
        )}
        {compact ? null : wait > 0 ? (
          <AppText muted style={styles.small}>
            إعادة الإرسال بعد {wait} ث
          </AppText>
        ) : (
          <Pressable onPress={resend} hitSlop={8}>
            <AppText weight="bold" style={[styles.small, { color: colors.primary }]}>
              إعادة إرسال الرمز
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = createStyles(() => ({
  container: { gap: spacing.md },
  hint: { fontSize: 14 },
  dev: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.warning,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devText: { color: '#92400E', fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontSize: 14 },
}));
