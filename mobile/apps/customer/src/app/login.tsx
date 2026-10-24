import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { login, UserRoles, validateLogin, type ApiError, type LoginErrors } from '@wasit/shared';
import { AppText, AuthCard, AuthLayout, Button, ErrorBanner, Input, colors, createStyles, useTheme } from '@wasit/ui';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export default function LoginScreen() {
  useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const found = validateLogin({ identifier, password });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      // نجاح الدخول يغيّر المخزن فيزول مسار الدخول تلقائياً (Stack.Protected)
      await login({ identifier, password }, [UserRoles.Customer]);
    } catch (e) {
      setServerError((e as ApiError).message);
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="مرحباً بعودتك" subtitle="سجّل دخولك للوصول إلى حسابك">
      <AuthCard>
        {serverError && <ErrorBanner title="فشل تسجيل الدخول" message={serverError} />}

        <Input
          label="رقم الهاتف أو البريد الإلكتروني"
          icon="person-outline"
          value={identifier}
          onChangeText={(t) => {
            setIdentifier(t);
            setErrors((p) => ({ ...p, identifier: undefined }));
          }}
          error={errors.identifier}
          placeholder="07XX XXX XXXX / name@email.com"
          autoCapitalize="none"
          autoComplete="username"
          keyboardType="email-address"
          ltr
        />
        <Input
          label="كلمة المرور"
          icon="lock-closed-outline"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setErrors((p) => ({ ...p, password: undefined }));
          }}
          error={errors.password}
          placeholder="••••••••"
          autoCapitalize="none"
          autoComplete="current-password"
          secure
          ltr
          onSubmitEditing={submit}
        />

        <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8}>
          <AppText weight="medium" style={{ color: colors.primary, fontSize: 14 }}>
            نسيت كلمة المرور؟
          </AppText>
        </Pressable>

        <Button title="تسجيل الدخول" loading={loading} onPress={submit} />
      </AuthCard>

      <View style={styles.divider}>
        <View style={styles.line} />
        <AppText muted style={{ fontSize: 13 }}>
          أو
        </AppText>
        <View style={styles.line} />
      </View>

      <GoogleSignInButton label="المواصلة باستخدام Google" onError={setServerError} />

      <AppText style={styles.signup}>
        ليس لديك حساب؟{' '}
        <AppText weight="bold" style={{ color: colors.primary }} onPress={() => router.replace('/register')}>
          إنشاء حساب جديد
        </AppText>
      </AppText>

      <AppText muted style={styles.terms}>
        بتسجيل دخولك، أنت توافق على{' '}
        <AppText style={styles.link} onPress={() => router.push({ pathname: '/info/[doc]', params: { doc: 'terms' } })}>
          شروط الاستخدام
        </AppText>{' '}
        و{' '}
        <AppText style={styles.link} onPress={() => router.push({ pathname: '/info/[doc]', params: { doc: 'privacy' } })}>
          سياسة الخصوصية
        </AppText>
      </AppText>
    </AuthLayout>
  );
}

const styles = createStyles(() => ({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  signup: { textAlign: 'center', fontSize: 15, color: '#374151' },
  terms: { textAlign: 'center', fontSize: 13, lineHeight: 22 },
  link: { color: colors.primary, fontSize: 13 },
}));
