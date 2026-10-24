import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { QUICK_PRICE_RANGES, type Category } from '@wasit/shared';
import { AppText, colors, fonts, createStyles, tc, useTheme } from '@wasit/ui';

export interface ProductFilters {
  categoryId?: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  hasDiscount: boolean;
  inStock: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: ProductFilters;
  onChange: (patch: Partial<ProductFilters>) => void;
  onClear: () => void;
  activeCount: number;
  resultCount: number;
  // الفئات المعروضة (الرئيسية والفرعية من القسم الحالي)
  roots: Category[];
  children: (parentId: string) => Category[];
}

function Check({ checked, color = colors.primary, small }: { checked: boolean; color?: string; small?: boolean }) {
  useTheme();
  const size = small ? 14 : 18;
  return (
    <View style={[styles.box, { width: size, height: size }, checked && { backgroundColor: color, borderColor: color }]}>
      {checked && <Ionicons name="checkmark" size={size - 4} color={colors.white} />}
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon?: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  useTheme();
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHead} onPress={() => setOpen(!open)}>
        <View style={styles.sectionTitle}>
          {icon && <Ionicons name={icon} size={16} color={colors.primary} />}
          <AppText weight="bold" style={{ fontSize: 15, color: tc('#1F2937') }}>
            {title}
          </AppText>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={tc("#9CA3AF")} />
      </Pressable>
      {open && <View style={{ marginTop: 12 }}>{children}</View>}
    </View>
  );
}

// درج الفلاتر (يفتح من اليمين كما في الويب): تصنيفات، نطاق سعر، تقييم، خيارات أخرى. الفلتر يُطبَّق فور اختياره
export function ProductFilterDrawer({ visible, onClose, filters, onChange, onClear, activeCount, resultCount, roots, children }: Props) {
  useTheme();
  const insets = useSafeAreaInsets();
  // حقلا السعر يُطبَّقان بزر «تطبيق النطاق»
  const [min, setMin] = useState(filters.minPrice);
  const [max, setMax] = useState(filters.maxPrice);
  useEffect(() => {
    setMin(filters.minPrice);
    setMax(filters.maxPrice);
  }, [filters.minPrice, filters.maxPrice]);

  const tree = useMemo(() => roots.map((r) => ({ root: r, kids: children(r.id) })), [roots, children]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="إغلاق" />
        <View style={[styles.drawer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.head}>
            <AppText weight="bold" style={{ fontSize: 17 }}>
              الفلاتر
            </AppText>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityLabel="إغلاق">
              <Ionicons name="close" size={20} color={tc("#6B7280")} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <View style={styles.titleRow}>
              <AppText weight="bold" style={{ fontSize: 16 }}>
                الفلاتر
              </AppText>
              {activeCount > 0 && (
                <Pressable style={styles.clear} onPress={onClear} hitSlop={8}>
                  <Ionicons name="close" size={12} color={tc("#EF4444")} />
                  <AppText style={{ color: tc('#EF4444'), fontSize: 12 }}>مسح الكل</AppText>
                </Pressable>
              )}
            </View>

            <Section title="التصنيفات" icon="cube-outline">
              <ScrollView nestedScrollEnabled style={{ maxHeight: 256 }}>
                {tree.map(({ root, kids }) => {
                  const selected = filters.categoryId === root.id;
                  return (
                    <View key={root.id}>
                      <Pressable
                        style={[styles.catRow, selected && styles.catActive]}
                        onPress={() => onChange({ categoryId: selected ? undefined : root.id })}
                      >
                        <Check checked={selected} />
                        <AppText weight="medium" numberOfLines={1} style={{ flex: 1, fontSize: 14, color: selected ? colors.primary : tc('#374151') }}>
                          {root.nameAr || root.name}
                        </AppText>
                      </Pressable>
                      {kids.length > 0 && (
                        <View style={styles.kids}>
                          {kids.map((c) => {
                            const on = filters.categoryId === c.id;
                            return (
                              <Pressable key={c.id} style={[styles.kidRow, on && styles.catActive]} onPress={() => onChange({ categoryId: on ? undefined : c.id })}>
                                <Check checked={on} small />
                                <AppText numberOfLines={1} style={{ flex: 1, fontSize: 13, color: on ? colors.primary : tc('#6B7280') }}>
                                  {c.nameAr || c.name}
                                </AppText>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </Section>

            <Section title="نطاق السعر" icon="pricetag-outline">
              <View style={{ gap: 12 }}>
                <View style={styles.priceRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText muted style={{ fontSize: 12 }}>
                      من (د.ع)
                    </AppText>
                    <TextInput value={min} onChangeText={(t) => setMin(t.replace(/\D/g, ''))} placeholder="0" placeholderTextColor={colors.placeholder} keyboardType="number-pad" style={styles.priceInput} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText muted style={{ fontSize: 12 }}>
                      إلى (د.ع)
                    </AppText>
                    <TextInput value={max} onChangeText={(t) => setMax(t.replace(/\D/g, ''))} placeholder="∞" placeholderTextColor={colors.placeholder} keyboardType="number-pad" style={styles.priceInput} />
                  </View>
                </View>
                <View style={styles.quick}>
                  {QUICK_PRICE_RANGES.map((r) => {
                    const active = filters.minPrice === r.min && filters.maxPrice === r.max;
                    return (
                      <Pressable key={r.label} style={[styles.quickChip, active && styles.quickActive]} onPress={() => onChange({ minPrice: r.min, maxPrice: r.max })}>
                        <AppText style={{ fontSize: 12, color: active ? colors.white : tc('#4B5563') }}>{r.label}</AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable style={styles.apply} onPress={() => onChange({ minPrice: min, maxPrice: max })}>
                  <AppText weight="medium" style={{ color: colors.white, fontSize: 14 }}>
                    تطبيق النطاق
                  </AppText>
                </Pressable>
              </View>
            </Section>

            <Section title="التقييم">
              <View style={{ gap: 4 }}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const selected = filters.minRating === String(star);
                  return (
                    <Pressable key={star} style={[styles.catRow, selected && { backgroundColor: tc('#FEFCE8') }]} onPress={() => onChange({ minRating: selected ? '' : String(star) })}>
                      <Check checked={selected} color={tc("#FACC15")} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons key={i} name="star" size={14} color={i <= star ? tc('#FACC15') : tc('#E5E7EB')} />
                        ))}
                        {star !== 5 && (
                          <AppText style={{ fontSize: 12, marginStart: 4, color: selected ? tc('#A16207') : tc('#374151') }}>فأكثر</AppText>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            <Section title="خيارات أخرى">
              <View style={{ gap: 6 }}>
                {(
                  [
                    ['hasDiscount', '🏷️ عروض وخصومات فقط', filters.hasDiscount],
                    ['inStock', '✅ المتوفر في المخزون', filters.inStock],
                  ] as const
                ).map(([key, label, on]) => (
                  <Pressable key={key} style={[styles.catRow, { paddingVertical: 10 }, on && styles.catActive]} onPress={() => onChange({ [key]: !on })}>
                    <Check checked={on} />
                    <AppText style={{ fontSize: 14, color: on ? colors.primary : tc('#374151') }}>{label}</AppText>
                  </Pressable>
                ))}
              </View>
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.show} onPress={onClose}>
              <AppText weight="bold" style={{ color: colors.white, fontSize: 15 }}>
                عرض {resultCount} نتيجة
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createStyles(() => ({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  drawer: { width: 300, maxWidth: '85%', backgroundColor: colors.surface },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  section: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { borderRadius: 4, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8 },
  catActive: { backgroundColor: '#EEF2FF' },
  kids: { marginEnd: 18, borderEndWidth: 2, borderEndColor: '#F3F4F6', paddingEnd: 8, gap: 2 },
  kidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  priceRow: { flexDirection: 'row', gap: 8 },
  priceInput: { height: 40, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14, textAlign: 'right' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: { paddingHorizontal: 10, height: 28, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  quickActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  apply: { height: 36, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  show: { height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));
