import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { login, UserRoles, validateLogin, type ApiError, type LoginErrors } from '@wasit/shared';
import { AppText, colors, createStyles, ErrorBanner, Input, useTheme } from '@wasit/ui';
import { ActionButton } from '../components/kit';
import { palette } from '../lib/palette';

// الدخول للتجار وموظفي المتاجر (الدور VENDOR). الحساب ينشئه المدير أو صاحب المتجر
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
      await login({ identifier, password }, [UserRoles.Vendor]);
    } catch (e) {
      setServerError((e as ApiError).message);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[palette.burnt, palette.amber]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
            <Ionicons name="storefront" size={40} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <AppText weight="extraBold" style={{ fontSize: 26 }}>وسيط بائع</AppText>
            <AppText muted>سجّل دخولك لإدارة متجرك</AppText>
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
          <View style={{ flexDirection: 'row' }}>
            <ActionButton title="دخول" loading={loading} onPress={submit} />
          </View>
          <AppText muted style={{ textAlign: 'center', fontSize: 13, lineHeight: 22 }}>
            موظف في متجر؟ ادخل برقمك وكلمة المرور التي أعطاك إياها صاحب المتجر.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', gap: 14, padding: 20 },
  icon: { alignSelf: 'center', width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
}));
