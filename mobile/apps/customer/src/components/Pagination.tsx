import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { paginationRange } from '@wasit/shared';
import { AppText, colors, createStyles, tc, useTheme } from '@wasit/ui';

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

// ترقيم الصفحات كما في الويب: سهم، 1 2 3 … الأخيرة، سهم
export function Pagination({ page, totalPages, onChange }: Props) {
  useTheme();
  if (totalPages <= 1) return null;
  return (
    <View style={styles.row}>
      <Pressable style={[styles.cell, page === 1 && styles.disabled]} disabled={page === 1} onPress={() => onChange(page - 1)} accessibilityLabel="الصفحة السابقة">
        <Ionicons name="chevron-forward" size={18} color={tc("#4B5563")} />
      </Pressable>
      {paginationRange(page, totalPages).map((p, i) =>
        p === '...' ? (
          <View key={`dots-${i}`} style={styles.cell}>
            <AppText muted>…</AppText>
          </View>
        ) : (
          <Pressable key={p} style={[styles.cell, p === page && styles.active]} onPress={() => onChange(p)} accessibilityLabel={`الصفحة ${p}`}>
            <AppText weight="medium" style={{ fontSize: 14, color: p === page ? colors.white : tc('#374151') }}>
              {p}
            </AppText>
          </Pressable>
        ),
      )}
      <Pressable
        style={[styles.cell, page === totalPages && styles.disabled]}
        disabled={page === totalPages}
        onPress={() => onChange(page + 1)}
        accessibilityLabel="الصفحة التالية"
      >
        <Ionicons name="chevron-back" size={18} color={tc("#4B5563")} />
      </Pressable>
    </View>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 20 },
  cell: { minWidth: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  active: { backgroundColor: colors.primary },
  disabled: { opacity: 0.35 },
}));
