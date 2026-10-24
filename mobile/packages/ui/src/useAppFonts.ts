import { useFonts } from 'expo-font';
import {
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
} from '@expo-google-fonts/tajawal';

// true عند اكتمال تحميل الخط (أو فشله — لا نحجب التطبيق بسبب الخط)
export const useAppFonts = (): boolean => {
  const [loaded, error] = useFonts({ Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold });
  return loaded || !!error;
};
