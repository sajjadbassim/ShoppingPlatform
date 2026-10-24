import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle, type ApiError } from '@wasit/shared';
import { AppText, colors, createStyles, tc, useTheme } from '@wasit/ui';
import { googleAvailable, googleErrorMessage, pickGoogleCredential } from '../lib/google';
import { toast } from '../lib/toast';

interface Props {
  label: string;
  // رمز دعوة صديق (يُطبَّق على الحساب الجديد فقط)
  referralCode?: string;
  onError: (message: string | null) => void;
}

// زر الدخول/التسجيل بـ Google. نجاح الدخول يغيّر المخزن فيزول مسار الدخول تلقائياً (Stack.Protected)
export function GoogleSignInButton({ label, referralCode, onError }: Props) {
  useTheme();
  const [loading, setLoading] = useState(false);

  const press = async () => {
    if (loading) return;
    onError(null);
    if (!googleAvailable()) {
      toast.info('الدخول بحساب Google غير متاح في هذه النسخة');
      return;
    }
    setLoading(true);
    try {
      const credential = await pickGoogleCredential();
      if (!credential) return setLoading(false); // ألغى المستخدم
      await signInWithGoogle(credential, referralCode);
    } catch (e) {
      // خطأ الخادم له message جاهزة، وغيره من المكتبة
      onError((e as ApiError).status ? (e as ApiError).message : googleErrorMessage(e));
      setLoading(false);
    }
  };

  return (
    <Pressable style={[styles.google, loading && { opacity: 0.6 }]} onPress={press} disabled={loading} accessibilityRole="button">
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <AppText weight="medium" style={styles.text}>
            {label}
          </AppText>
          <Ionicons name="logo-google" size={20} color={tc("#4285F4")} />
        </>
      )}
    </Pressable>
  );
}

const styles = createStyles(() => ({
  google: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: { fontSize: 15, color: '#374151' },
}));
