import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { validateReview, type ApiError, type PickedImage, type ReviewErrors } from '@wasit/shared';
import { AppText, AuthCard, AuthLayout, Button, ErrorBanner, Input, StarRating, tc, useTheme } from '@wasit/ui';
import { useCreateReview } from '../api/useFeedback';
import { ImagePickerRow } from '../components/ImagePickerRow';
import { toast } from '../lib/toast';

export default function NewReviewScreen() {
  useTheme();
  const { productId, orderId, name } = useLocalSearchParams<{ productId: string; orderId: string; name?: string }>();
  const create = useCreateReview();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async () => {
    const found = validateReview({ rating, title, body });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    try {
      const review = await create.mutateAsync({ productId, orderId, rating, title, body, images });
      const points = review.pointsEarned ? ` وكسبت ${review.pointsEarned} نقطة ولاء` : '';
      toast.success(`تم نشر تقييمك${points}`, { title: 'شكراً لتقييمك' });
      router.back();
    } catch (e) {
      setServerError((e as ApiError).message || 'تعذّر إرسال التقييم');
    }
  };

  return (
    <AuthLayout title="قيّم المنتج" subtitle={name}>
      <AuthCard>
        {serverError && <ErrorBanner title="تعذّر الإرسال" message={serverError} />}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <StarRating
            value={rating}
            size={40}
            onChange={(n) => {
              setRating(n);
              setErrors((p) => ({ ...p, rating: undefined }));
            }}
          />
          {!!errors.rating && <AppText style={{ color: tc('#DC2626'), fontSize: 13 }}>{errors.rating}</AppText>}
        </View>
        <Input label="عنوان (اختياري)" value={title} onChangeText={setTitle} error={errors.title} maxLength={200} />
        <Input label="رأيك بالمنتج (اختياري)" value={body} onChangeText={setBody} error={errors.body} multiline maxLength={2000} />
        <ImagePickerRow label="صور المنتج (اختياري)" images={images} onChange={setImages} />
        <Button title="إرسال التقييم" loading={create.isPending} onPress={submit} />
      </AuthCard>
      <Button title="إلغاء" variant="outline" onPress={() => router.back()} />
    </AuthLayout>
  );
}
