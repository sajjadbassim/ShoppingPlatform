import { Pressable, StyleSheet, View } from 'react-native';
import type { DeliveryZone } from '@wasit/shared';
import { AppText, colors, createStyles, tc, useTheme } from '@wasit/ui';

interface Props {
  zones: DeliveryZone[];
  value?: string | null;
  onChange: (zoneId: string) => void;
  disabled?: boolean;
}

// اختيار منطقة التوصيل (تحدد الرسوم): شرائح بالاسم والسعر
export function ZonePicker({ zones, value, onChange, disabled }: Props) {
  useTheme();
  return (
    <View style={[styles.row, disabled && { opacity: 0.5 }]}>
      {zones.map((z) => {
        const active = z.id === value;
        return (
          <Pressable key={z.id} disabled={disabled} onPress={() => onChange(z.id)} style={[styles.chip, active && styles.active]}>
            <AppText weight="medium" style={{ fontSize: 13, color: active ? colors.white : tc('#374151') }}>
              {z.name} — {Math.round(z.fee).toLocaleString('en-US')} د.ع
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, height: 36, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
}));
