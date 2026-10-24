import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText, colors, createStyles, createThemed, tc, useTheme } from '@wasit/ui';
import { closeDialog, subscribeDialog, type DialogState } from '../lib/dialog';

const TONES = createThemed(() => ({
  danger: { bg: tc('#FEE2E2'), fg: tc('#DC2626'), icon: 'trash-outline' as const },
  primary: { bg: tc('#EEF2FF'), fg: colors.primary, icon: 'help-circle-outline' as const },
}));

// يُركَّب مرة واحدة في الجذر: نافذة تأكيد في الوسط، وقائمة إجراءات من الأسفل
export function DialogHost() {
  useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeDialog(setState), []);

  const visible = !!state;
  const dismiss = () => {
    if (!busy) closeDialog();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable style={[styles.backdrop, state?.kind === 'sheet' && { justifyContent: 'flex-end' }]} onPress={dismiss}>
        {state?.kind === 'confirm' && (
          <Pressable style={styles.card} onPress={() => {}}>
            {(() => {
              const tone = TONES[state.tone ?? 'primary'];
              return (
                <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
                  <Ionicons name={state.icon ?? tone.icon} size={28} color={tone.fg} />
                </View>
              );
            })()}
            <AppText weight="bold" style={styles.title}>
              {state.title}
            </AppText>
            {!!state.message && <AppText muted style={styles.message}>{state.message}</AppText>}
            <View style={styles.buttons}>
              <Pressable style={[styles.btn, styles.cancel]} onPress={dismiss} disabled={busy}>
                <AppText weight="medium" style={{ color: tc('#374151'), fontSize: 15 }}>
                  {state.cancelText ?? 'إلغاء'}
                </AppText>
              </Pressable>
              <Pressable
                style={[styles.btn, { backgroundColor: state.tone === 'danger' ? tc('#DC2626') : colors.primary }, busy && { opacity: 0.7 }]}
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await state.onConfirm();
                  } finally {
                    setBusy(false);
                    closeDialog();
                  }
                }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <AppText weight="bold" style={{ color: colors.white, fontSize: 15 }}>
                    {state.confirmText ?? 'تأكيد'}
                  </AppText>
                )}
              </Pressable>
            </View>
          </Pressable>
        )}

        {state?.kind === 'sheet' && (
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
            <View style={styles.handle} />
            {!!state.title && (
              <AppText weight="bold" style={styles.sheetTitle}>
                {state.title}
              </AppText>
            )}
            {state.actions.map((a) => (
              <Pressable
                key={a.label}
                style={styles.sheetItem}
                onPress={() => {
                  closeDialog();
                  a.onPress();
                }}
              >
                <View style={[styles.sheetIcon, a.destructive && { backgroundColor: tc('#FEE2E2') }]}>
                  {!!a.icon && <Ionicons name={a.icon} size={20} color={a.destructive ? tc('#DC2626') : tc('#374151')} />}
                </View>
                <AppText weight="medium" style={{ fontSize: 16, color: a.destructive ? tc('#DC2626') : colors.text }}>
                  {a.label}
                </AppText>
              </Pressable>
            ))}
            <Pressable style={styles.sheetCancel} onPress={dismiss}>
              <AppText weight="medium" style={{ color: tc('#4B5563'), fontSize: 15 }}>
                إلغاء
              </AppText>
            </Pressable>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = createStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'center', padding: 28 },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, alignItems: 'center', gap: 8 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 19, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 16, alignSelf: 'stretch' },
  btn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: '#F3F4F6' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, gap: 4, margin: -28 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { fontSize: 17, marginBottom: 8, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 56 },
  sheetIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sheetCancel: { height: 50, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
}));
