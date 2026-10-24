import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login, UserRoles, validateLogin, type ApiError, type LoginErrors } from '@wasit/shared';
import { AppText, brand, Button, colors, createStyles, ErrorBanner, Input, radius, useTheme } from '@wasit/ui';

// كما في الشاشة التصورية: أيقونة المندوب وعنوان وحقلان وزر، دون بطاقة تحيط بالحقول
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
      await login({ identifier, password }, [UserRoles.Driver]);
    } catch (e) {
      setServerError((e as ApiError).message);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.icon}>
            <AppText style={{ fontSize: 40, lineHeight: 56 }}>🛵</AppText>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <AppText weight="extraBold" style={{ fontSize: 24 }}>وسيط مندوب</AppText>
            <AppText muted>سجّل دخولك لبدء الدوام</AppText>
          </View>
          {serverError && <ErrorBanner title="فشل تسجيل الدخول" message={serverError} />}
          <Input
            label="رقم الهاتف"
            icon="call-outline"
            value={identifier}
            onChangeText={(t) => {
              setIdentifier(t);
              setErrors((p) => ({ ...p, identifier: undefined }));
            }}
            error={errors.identifier}
            placeholder="07XX XXX XXXX"
            autoCapitalize="none"
            autoComplete="username"
            keyboardType="phone-pad"
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
          <Button title="دخول" loading={loading} onPress={submit} />
          <AppText muted style={{ textAlign: 'center', fontSize: 13, lineHeight: 22 }}>
            الحساب ينشئه المدير. لا تملك حساباً؟ تواصل مع الإدارة.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', gap: 14, padding: 20 },
  icon: { alignSelf: 'center', width: 84, height: 84, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
}));
