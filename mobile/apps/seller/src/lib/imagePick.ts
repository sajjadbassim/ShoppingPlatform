import * as ImagePicker from 'expo-image-picker';
import { actionSheet } from './dialog';
import { toast } from './toast';

export type ImageSource = 'camera' | 'library';

// قائمة «من أين؟» قبل أي إضافة صورة: الكاميرا أو المعرض
export const chooseSource = (title: string, onChoose: (source: ImageSource) => void) =>
  actionSheet({
    title,
    actions: [
      { label: 'التقاط بالكاميرا', icon: 'camera-outline', onPress: () => onChoose('camera') },
      { label: 'اختيار من المعرض', icon: 'images-outline', onPress: () => onChoose('library') },
    ],
  });

// الكاميرا تلتقط عنصراً واحداً كل مرة. null = لم تُمنح الصلاحية أو تعذّر الفتح (وقد أُظهرت رسالة)
export const openCamera = async (options: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult | null> => {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.error('امنح التطبيق إذن الكاميرا من إعدادات الهاتف');
      return null;
    }
    return await ImagePicker.launchCameraAsync(options);
  } catch {
    toast.error('تعذّر فتح الكاميرا');
    return null;
  }
};
