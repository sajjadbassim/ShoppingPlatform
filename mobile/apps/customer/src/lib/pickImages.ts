import * as ImagePicker from 'expo-image-picker';
import { MAX_UPLOAD_BYTES, type PickedImage } from '@wasit/shared';
import { toast } from './toast';

const EXT_TYPES: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

// يفتح معرض الصور ويعيد صوراً جاهزة للرفع (JPEG/PNG/WebP حتى 3MB)
export async function pickImages(limit: number): Promise<PickedImage[]> {
  if (limit <= 0) return [];
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    toast.warning('اسمح للتطبيق بالوصول إلى الصور من إعدادات الهاتف', { title: 'الصلاحية مطلوبة' });
    return [];
  }

  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      quality: 0.7,
    });
  } catch {
    // أجهزة/محاكيات بلا تطبيق معرض صور يستجيب لطلب الاختيار
    toast.warning('لا يوجد تطبيق معرض صور على هذا الجهاز', { title: 'تعذّر فتح المعرض' });
    return [];
  }
  if (result.canceled) return [];

  const picked: PickedImage[] = [];
  let tooBig = 0;
  for (const asset of result.assets) {
    if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
      tooBig++;
      continue;
    }
    const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
    const type = asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : (EXT_TYPES[ext] ?? 'image/jpeg');
    picked.push({ uri: asset.uri, name: asset.fileName || `image-${Date.now()}-${picked.length}.${ext in EXT_TYPES ? ext : 'jpg'}`, type });
  }
  if (tooBig > 0) toast.warning('حجم الصورة يجب ألا يتجاوز 3MB', { title: 'حجم الصورة كبير' });
  return picked.slice(0, limit);
}
