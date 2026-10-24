import { useState } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  forgotPassword,
  normalizeIraqiPhone,
  resetPassword,
  validateNewPassword,
  validateResetPhone,
  verifyResetOtp,
  type ApiError,
  type NewPasswordErrors,
} from '@wasit/shared';
import { AppText, AuthCard, AuthLayout, Button, ErrorBanner, Input, OtpCodeForm, colors, useTheme } from '@wasit/ui';

// 1 هاتف ← 2 رمز التحقق ← 3 كلمة مرور جديدة ← 4 نجاح
type Step = 1 | 2 | 3 | 4;

const SUBTITLES: Record<Step, string> = {
  1: 'أدخل رقم هاتفك وسنرسل لك رمز التحقق',
  2: 'أدخل رمز التحقق المُرسل إلى هاتفك',
  3: 'أدخل كلمة المرور الجديدة',
  4: '',
};

export default function ForgotPasswordScreen() {
  useTheme();
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [devCode, setDevCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<NewPasswordErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalizedPhone = normalizeIraqiPhone(phone) ?? phone.replace(/\s/g, '');

  const sendCode = async () => {
    const error = validateResetPhone(phone);
    setPhoneError(error);
    if (error) return;

    setBusy(true);
    try {
      setDevCode(await forgotPassword(normalizedPhone));
      setStep(2);
    } catch (e) {
      setPhoneError((e as ApiError).message || 'تعذّر إرسال رمز التحقق');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    const found = validateNewPassword({ password, confirmPassword });
    setPasswordErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await resetPassword(resetToken, password);
      setStep(4);
    } catch (e) {
      setServerError((e as ApiError).message || 'تعذّر تغيير كلمة المرور');
    } finally {
      setBusy(false);
    }
  };

  if (step === 4) {
    return (
      <AuthLayout title="تم تغيير كلمة المرور" subtitle="يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة">
        <Button title="تسجيل الدخول" onPress={() => router.replace('/login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="نسيت كلمة المرور؟" subtitle={SUBTITLES[step]}>
      <AuthCard>
        {step === 1 && (
          <>
            <Input
              label="رقم الهاتف"
              icon="call-outline"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setPhoneError(undefined);
              }}
              error={phoneError}
              placeholder="07XX XXX XXXX"
              keyboardType="phone-pad"
              autoComplete="tel"
              ltr
            />
            <Button title="إرسال رمز التحقق" loading={busy} onPress={sendCode} />
          </>
        )}

        {step === 2 && (
          <OtpCodeForm
            phone={normalizedPhone}
            initialDevCode={devCode}
            submitText="تحقق"
            compact
            onVerify={async (code) => {
              setResetToken(await verifyResetOtp(normalizedPhone, code));
              setStep(3);
            }}
            onResend={() => forgotPassword(normalizedPhone)}
            onChangePhone={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <>
            {serverError && <ErrorBanner title="تعذّر تغيير كلمة المرور" message={serverError} />}
            <Input
              label="كلمة المرور الجديدة"
              icon="lock-closed-outline"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setPasswordErrors((p) => ({ ...p, password: undefined }));
              }}
              error={passwordErrors.password}
              autoCapitalize="none"
              secure
              ltr
            />
            <Input
              label="تأكيد كلمة المرور"
              icon="lock-closed-outline"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setPasswordErrors((p) => ({ ...p, confirmPassword: undefined }));
              }}
              error={passwordErrors.confirmPassword}
              autoCapitalize="none"
              secure
              ltr
            />
            <Button title="تغيير كلمة المرور" loading={busy} onPress={submitPassword} />
          </>
        )}
      </AuthCard>

      {step === 1 && (
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AppText muted style={{ fontSize: 15 }}>
            العودة لتسجيل الدخول
          </AppText>
          <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </AuthLayout>
  );
}
