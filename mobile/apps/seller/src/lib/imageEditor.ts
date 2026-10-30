import { router } from 'expo-router';

// شاشة التعديل تُفتح كخطوة وسيطة: يُنتظر ناتجها كوعد. null = تخطّى أو رجع، وإلا رابط الصورة المعدّلة
let pending: ((uri: string | null) => void) | null = null;

export const editImage = (uri: string): Promise<string | null> =>
  new Promise((resolve) => {
    pending?.(null);
    pending = resolve;
    router.push({ pathname: '/edit-image', params: { uri } });
  });

export const finishEdit = (uri: string | null) => {
  pending?.(uri);
  pending = null;
};
