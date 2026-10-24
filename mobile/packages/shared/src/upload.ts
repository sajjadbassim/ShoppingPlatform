import { api } from './api';
import { API_ENDPOINTS } from './endpoints';
import { patchSession } from './session';

// صورة اختارها المستخدم من الجهاز (تُرسل كملف في FormData)
export interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

// React Native يقبل { uri, name, type } كملف داخل FormData
export const appendImages = (fd: FormData, field: string, images: PickedImage[] = []) => {
  for (const image of images) fd.append(field, image as unknown as Blob);
};

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

export const uploadAvatar = async (image: PickedImage): Promise<string | null> => {
  const fd = new FormData();
  appendImages(fd, 'file', [image]);
  const res = await api.put(API_ENDPOINTS.PROFILE.AVATAR, fd, MULTIPART);
  const avatarUrl = (res.data?.data ?? res.data)?.avatarUrl ?? null;
  patchSession({ avatarUrl });
  return avatarUrl;
};

export const removeAvatar = async () => {
  await api.delete(API_ENDPOINTS.PROFILE.AVATAR);
  patchSession({ avatarUrl: null });
};
