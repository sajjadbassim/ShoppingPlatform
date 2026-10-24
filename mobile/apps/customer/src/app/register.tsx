import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  normalizeIraqiPhone,
  register,
  sendPhoneCode,
  validateNewPassword,
  validateRegisterInfo,
  verifyPhoneCode,
  type ApiError,
  type NewPasswordErrors,
  type RegisterInfoErrors,
} from '@wasit/shared';
import { AppText, AuthCard, AuthLayout, Button, Checkbox, ErrorBanner, Input, OtpCodeForm, colors, createStyles, useTheme } from '@wasit/ui';
import { toast } from '../lib/toast';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

// الخطوات: 1 المعلومات ← 2 رمز واتساب لتأكيد الرقم ← 3 كلمة المرور (كما في الويب)
type Step = 1 | 2 | 3;

const TITLES: Record<Step, string> = {
  1: 'المعلومات الأساسية',
  2: 'تأكيد رقم الهاتف',
  3: 'كلمة المرور',
};

export default function RegisterScreen() {
  useTheme();
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [infoErrors, setInfoErrors] = useState<RegisterInfoErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<NewPasswordErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState('');
  // رمز إثبات ملكية الرقم (عمره 30 دقيقة في الخادم)
  const [verification, setVerification] = useState<{ phone: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const normalizedPhone = normalizeIraqiPhone(phone) ?? phone.replace(/\s/g, '');

  // التالي من الخطوة 1: رقم مؤكَّد سابقاً (رجع ليعدّل اسمه) ننتقل لكلمة المرور، وإلا نرسل الرمز
  const goToVerify = async () => {
    const found = validateRegisterInfo({ fullName, phone, email });
    setInfoErrors(found);
    if (Object.keys(found).length > 0) return;

    if (verification?.phone === normalizedPhone) {
      setStep(3);
      return;
    }
    setBusy(true);
    try {
      setDevCode(await sendPhoneCode(normalizedPhone));
      setStep(2);
    } catch (e) {
      setInfoErrors({ phone: (e as ApiError).message || 'تعذّر إرسال رمز التحقق' });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const found = validateNewPassword({ password, confirmPassword, agreeTerms, requireTerms: true });
    setPasswordErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      // نجاح التسجيل يحفظ الجلسة فيزول مسار التسجيل تلقائياً (Stack.Protected)
      await register({
        phone: normalizedPhone,
        password,
        fullName,
        email,
        referralCode,
        phoneVerificationToken: verification?.token,
      });
    } catch (e) {
      const message = (e as ApiError).message;
      // انتهت صلاحية إثبات الرقم: نعيد المستخدم لتأكيده من جديد
      if (message?.includes('أكّد رقم هاتفك')) {
        setVerification(null);
        setStep(1);
      }
      setServerError(message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="إنشاء حساب جديد">
      <View style={styles.progress}>
        <View style={styles.progressText}>
          <AppText muted style={{ fontSize: 12 }}>
            الخطوة {step} من 3
          </AppText>
          <AppText muted style={{ fontSize: 12 }}>
            {Math.round((step / 3) * 100)}%
          </AppText>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(step / 3) * 100}%` }]} />
        </View>
      </View>

      <AuthCard>
        {serverError && <ErrorBanner title="تعذّر إنشاء الحساب" message={serverError} />}

        {step === 1 && (
          <>
            <GoogleSignInButton label="الاشتراك من خلال Google" referralCode={referralCode.trim()} onError={setServerError} />
            <View style={styles.divider}>
              <View style={styles.line} />
              <AppText muted style={{ fontSize: 12 }}>
                أو أنشئ حساباً برقم هاتفك
              </AppText>
              <View style={styles.line} />
            </View>

            <AppText weight="extraBold" style={styles.heading}>
              {TITLES[1]}
            </AppText>

            <View style={{ gap: 8 }}>
              <AppText weight="medium" style={{ fontSize: 14 }}>
                نوع الحساب
              </AppText>
              <View style={styles.types}>
                <View style={[styles.type, styles.typeActive]}>
                  <Ionicons name="person-outline" size={26} color={colors.primary} />
                  <AppText weight="bold" style={{ color: colors.primary, fontSize: 15 }}>
                    عميل
                  </AppText>
                  <AppText muted style={styles.typeHint}>
                    للتسوق والشراء
                  </AppText>
                </View>
                {/* حساب البائع يُنشأ من الموقع؛ تطبيق الزبون لا يدعمه */}
                <Pressable
                  style={styles.type}
                  onPress={() => toast.info('إنشاء حساب بائع قادم قريباً، ويمكنك إنشاؤه الآن من الموقع')}
                >
                  <Ionicons name="storefront-outline" size={26} color={colors.textMuted} />
                  <AppText weight="bold" style={{ fontSize: 15 }}>
                    بائع
                  </AppText>
                  <AppText muted style={styles.typeHint}>
                    لإنشاء متجر
                  </AppText>
                </Pressable>
              </View>
            </View>

            <Input
              label="الاسم الكامل *"
              value={fullName}
              onChangeText={(t) => {
                setFullName(t);
                setInfoErrors((p) => ({ ...p, fullName: undefined }));
              }}
              error={infoErrors.fullName}
              autoComplete="name"
            />
            <Input
              label="رقم الهاتف *"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setInfoErrors((p) => ({ ...p, phone: undefined }));
              }}
              error={infoErrors.phone}
              placeholder="07XX XXX XXXX"
              keyboardType="phone-pad"
              autoComplete="tel"
              ltr
            />
            <Input
              label="البريد الإلكتروني *"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setInfoErrors((p) => ({ ...p, email: undefined }));
              }}
              error={infoErrors.email}
              placeholder="name@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              ltr
            />
            <Input
              label="رمز دعوة صديق (اختياري)"
              value={referralCode}
              onChangeText={setReferralCode}
              autoCapitalize="characters"
              placeholder="ABC2345"
              ltr
            />
            <AppText muted style={{ fontSize: 13, lineHeight: 22, marginTop: -8 }}>
              تحصل أنت وصديقك على نقاط عند تسليم أول طلب لك
            </AppText>
            <Button title="التالي" loading={busy} onPress={goToVerify} />
          </>
        )}

        {step > 1 && (
          <AppText weight="extraBold" style={styles.heading}>
            {TITLES[step]}
          </AppText>
        )}

        {step === 2 && (
          <OtpCodeForm
            phone={normalizedPhone}
            initialDevCode={devCode}
            submitText="تأكيد الرقم"
            onVerify={async (code) => {
              const token = await verifyPhoneCode(normalizedPhone, code);
              setVerification({ phone: normalizedPhone, token });
              setStep(3);
            }}
            onResend={() => sendPhoneCode(normalizedPhone)}
            onChangePhone={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <>
            <Input
              label="كلمة المرور *"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setPasswordErrors((p) => ({ ...p, password: undefined }));
              }}
              error={passwordErrors.password}
              placeholder="6 أحرف على الأقل"
              autoCapitalize="none"
              secure
              ltr
            />
            <Input
              label="تأكيد كلمة المرور *"
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
            <Checkbox
              checked={agreeTerms}
              onChange={(v) => {
                setAgreeTerms(v);
                setPasswordErrors((p) => ({ ...p, agreeTerms: undefined }));
              }}
              label={
                <>
                  أوافق على{' '}
                  <AppText style={styles.link} onPress={() => router.push({ pathname: '/info/[doc]', params: { doc: 'terms' } })}>
                    شروط الاستخدام
                  </AppText>{' '}
                  و{' '}
                  <AppText style={styles.link} onPress={() => router.push({ pathname: '/info/[doc]', params: { doc: 'privacy' } })}>
                    سياسة الخصوصية
                  </AppText>
                </>
              }
              error={passwordErrors.agreeTerms}
            />
            <View style={styles.actions}>
              <Button title="إنشاء الحساب" loading={busy} onPress={submit} style={{ flex: 1.4 }} />
              <Button title="السابق" variant="outline" onPress={() => setStep(1)} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </AuthCard>

      <AppText muted style={{ textAlign: 'center', fontSize: 14 }}>
        لديك حساب بالفعل؟{' '}
        <AppText weight="bold" style={{ color: colors.primary, fontSize: 14 }} onPress={() => router.replace('/login')}>
          تسجيل الدخول
        </AppText>
      </AppText>
    </AuthLayout>
  );
}

const styles = createStyles(() => ({
  progress: { gap: 6 },
  progressText: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden', flexDirection: 'row' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  heading: { fontSize: 28, lineHeight: 40 },
  types: { flexDirection: 'row', gap: 12 },
  type: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  typeActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  link: { color: colors.primary, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  typeHint: { fontSize: 12 },
}));
