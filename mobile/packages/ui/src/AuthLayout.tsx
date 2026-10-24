import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './AppText';
import { colors, radius, spacing, createStyles, tc, useTheme } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

// هيكل شاشات الدخول والتسجيل واستعادة كلمة المرور: الشعار والعنوان وبطاقة المحتوى
export function AuthLayout({ title, subtitle, children }: Props) {
  const dark = useTheme() === 'dark';
  return (
    <LinearGradient colors={dark ? [colors.background, colors.surface] : ['#FFFFFF', '#F5F5FF']} style={styles.flex}>
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <AppText weight="extraBold" style={styles.logoText}>
              و
            </AppText>
          </View>
          <AppText weight="extraBold" style={styles.title}>
            {title}
          </AppText>
          {!!subtitle && (
            <AppText muted style={styles.subtitle}>
              {subtitle}
            </AppText>
          )}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </LinearGradient>
  );
}

// بطاقة بيضاء لمحتوى النموذج
export function AuthCard({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.card}>{children}</View>;
}

// رسالة خطأ عامة أعلى النموذج
export function ErrorBanner({ title, message }: { title: string; message: string }) {
  useTheme();
  return (
    <View style={styles.errorBox}>
      <AppText weight="bold" style={styles.errorText}>
        {title}
      </AppText>
      <AppText style={styles.errorText}>{message}</AppText>
    </View>
  );
}

const styles = createStyles(() => ({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: 'center' },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  logoText: { color: colors.white, fontSize: 40, lineHeight: 56, textAlign: 'center' },
  title: { fontSize: 32, lineHeight: 44, textAlign: 'center', marginTop: spacing.sm },
  subtitle: { textAlign: 'center', marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 28, padding: spacing.lg, gap: spacing.md, elevation: 4, shadowColor: colors.primary, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
  errorText: { color: colors.errorDark, fontSize: 14 },
}));
