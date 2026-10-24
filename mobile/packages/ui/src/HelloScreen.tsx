import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { API_URL, pingApi } from '@wasit/shared';
import { colors, spacing, createStyles, tc, useTheme } from './theme';

interface Props {
  title: string;
  subtitle: string;
  environment: string;
}

// شاشة «مرحباً» لإثبات أن التطبيق يعمل على الهاتف ويصل للخادم
export function HelloScreen({ title, subtitle, environment }: Props) {
  useTheme();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const check = async () => {
    setChecking(true);
    setResult(await pingApi());
    setChecking(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Text style={styles.meta}>البيئة: {environment}</Text>
      <Text style={styles.meta}>الخادم: {API_URL}</Text>

      <Pressable style={styles.button} onPress={check} disabled={checking}>
        {checking ? <ActivityIndicator color={tc("#fff")} /> : <Text style={styles.buttonText}>فحص الاتصال بالخادم</Text>}
      </Pressable>

      {result && (
        <Text style={[styles.result, { color: result.ok ? colors.success : colors.errorDark }]}>{result.message}</Text>
      )}
    </View>
  );
}

const styles = createStyles(() => ({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { fontSize: 32, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 18, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg },
  meta: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  button: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: 10, minWidth: 220, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  result: { marginTop: spacing.md, fontSize: 16, fontWeight: '600' },
}));
