import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homeService } from '../services/homeService';

const bannerKeys = { all: ['home-banners-admin'] };
const sectionKeys = { all: ['home-sections-admin'] };

// بانرات "بلوك البانرات" تظهر ضمن الأقسام، فتغيير البانرات يحدّث الاثنين
const invalidateBanners = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: bannerKeys.all });
  queryClient.invalidateQueries({ queryKey: sectionKeys.all });
};

// ============ Banners ============

export const useBannersAdmin = () => useQuery({
  queryKey: bannerKeys.all,
  queryFn: () => homeService.getBanners(false),
  staleTime: 30 * 1000,
});

export const useCreateBanner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData) => homeService.createBanner(formData),
    onSuccess: () => invalidateBanners(queryClient),
  });
};

export const useUpdateBanner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }) => homeService.updateBanner(id, formData),
    onSuccess: () => invalidateBanners(queryClient),
  });
};

export const useDeleteBanner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => homeService.deleteBanner(id),
    onSuccess: () => invalidateBanners(queryClient),
  });
};

// ============ Sections ============

export const useSectionsAdmin = () => useQuery({
  queryKey: sectionKeys.all,
  queryFn: () => homeService.getSections(false),
  staleTime: 30 * 1000,
});

export const useCreateSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto) => homeService.createSection(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionKeys.all }),
  });
};

export const useUpdateSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }) => homeService.updateSection(id, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionKeys.all }),
  });
};

export const useDeleteSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => homeService.deleteSection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionKeys.all }),
  });
};

export const useAddSectionItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, productId, displayOrder }) => homeService.addSectionItem(sectionId, productId, displayOrder),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionKeys.all }),
  });
};

export const useRemoveSectionItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, productId }) => homeService.removeSectionItem(sectionId, productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionKeys.all }),
  });
};

// ============ بانر رأس القسم ============

export const useSetSectionBanner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }) => homeService.setSectionBanner(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionKeys.all }),
  });
};

export const useRemoveSectionBanner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => homeService.removeSectionBanner(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectionKeys.all }),
  });
};
