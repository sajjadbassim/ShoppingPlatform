// عنوان الـ API من متغير بيئة عام (EXPO_PUBLIC_*) — لا أسرار هنا أبداً
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5010';

// التوقيت المعتمد لكل التواريخ المعروضة
export const TIME_ZONE = 'Asia/Baghdad';
