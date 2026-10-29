import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, colors } from '@wasit/ui';
import { palette } from '../../lib/palette';

// أزرار الحسابات: ارتفاع وخط وعرض موحّدة (تتقاسم الصف بالتساوي) وسطر واحد دائماً
export function MiniButton({ title, icon, tone, onPress, loading, small }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; tone: 'solid' | 'soft' | 'bad'; onPress: () => void; loading?: boolean; small?: boolean }) {
  const fg = tone === 'solid' ? '#FFFFFF' : tone === 'bad' ? palette.badText : colors.primaryHover;
  const bg = tone === 'solid' ? colors.primaryHover : tone === 'bad' ? palette.badSoft : colors.primaryLight;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, height: small ? 36 : 40, borderRadius: 12, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed || loading ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={16} color={fg} />
      <AppText weight="bold" numberOfLines={1} style={{ color: fg, fontSize: small ? 13 : 13.5 }}>{loading ? '...' : title}</AppText>
    </Pressable>
  );
}
