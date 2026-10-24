import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { PickedImage } from '@wasit/shared';
import { AppText, colors, createStyles, useTheme } from '@wasit/ui';
import { pickImages } from '../lib/pickImages';

interface Props {
  label: string;
  images: PickedImage[];
  onChange: (images: PickedImage[]) => void;
  max?: number;
}

// صف إضافة صور (تقييم/إرجاع): معاينة مصغّرة مع حذف، وزر إضافة حتى الحد الأقصى
export function ImagePickerRow({ label, images, onChange, max = 5 }: Props) {
  useTheme();
  const add = async () => onChange([...images, ...(await pickImages(max - images.length))]);

  return (
    <View style={{ gap: 8 }}>
      <AppText weight="medium" style={{ fontSize: 14 }}>
        {label}
      </AppText>
      <View style={styles.row}>
        {images.map((img, i) => (
          <View key={img.uri} style={styles.thumb}>
            <Image source={{ uri: img.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Pressable style={styles.remove} onPress={() => onChange(images.filter((_, idx) => idx !== i))} hitSlop={6} accessibilityLabel="حذف الصورة">
              <Ionicons name="close" size={14} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {images.length < max && (
          <Pressable style={[styles.thumb, styles.add]} onPress={add} accessibilityLabel="إضافة صورة">
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
            <AppText muted style={{ fontSize: 11 }}>
              {images.length}/{max}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  remove: { position: 'absolute', top: 4, end: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
}));
