import { useQuery } from '@tanstack/react-query';
import { fetchHomeSection, fetchStores } from '@wasit/shared';

// كل المتاجر النشطة (عددها في المدينة صغير)
export const useStores = () => useQuery({ queryKey: ['stores', 'all'], queryFn: fetchStores, staleTime: 5 * 60 * 1000 });

export const useHomeSection = (id?: string) =>
  useQuery({ queryKey: ['home-section', id], queryFn: () => fetchHomeSection(id as string), enabled: !!id, staleTime: 60 * 1000 });
