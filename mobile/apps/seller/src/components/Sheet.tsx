import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';

// نافذة من الأسفل (رفض طلب، نموذج كوبون، فلاتر...). تُغلق بالضغط على الخلفية ما لم تكن مشغولة
export function Sheet({ visible, onClose, title, subtitle, children, footer, busy }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; busy?: boolean }) {
  useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={() => !busy && onClose()}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]} onPress={() => {}}>
            <View style={styles.grab} />
            <AppText weight="extraBold" style={{ fontSize: 19 }}>{title}</AppText>
            {!!subtitle && <AppText muted style={{ fontSize: 13.5, lineHeight: 22, marginTop: 2 }}>{subtitle}</AppText>}
            <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ gap: 12, paddingBottom: 4 }} keyboardShouldPersistTaps="handled" bounces={false}>
              {children}
            </ScrollView>
            {footer && <View style={styles.footer}>{footer}</View>}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = createStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(42,26,14,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, maxHeight: '88%' },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#E8D9C2', marginBottom: 12 },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 12 },
}));
