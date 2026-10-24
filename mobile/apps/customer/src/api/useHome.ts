import { useQuery } from '@tanstack/react-query';
import { fetchBuyAgain, fetchHome, useSessionStore, type HomePageKind } from '@wasit/shared';

// page: general (الرئيسية) | grocery (السوبرماركت)
export const useHome = (page: HomePageKind = 'general') =>
  useQuery({ queryKey: ['home', page], queryFn: () => fetchHome(page) });

// اشترِ مجدداً: للمسجّل فقط
export const useBuyAgain = (page: HomePageKind = 'general') => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: ['buy-again', page], queryFn: () => fetchBuyAgain(page, 20), enabled: signedIn, staleTime: 5 * 60 * 1000 });
};
