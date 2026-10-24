import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createReturn, createReview, fetchMyReturns, fetchReviews, fetchReviewSummary, setReviewHelpful, useSessionStore } from '@wasit/shared';

export const useReviewSummary = (productId: string) =>
  useQuery({ queryKey: ['review-summary', productId], queryFn: () => fetchReviewSummary(productId) });

export const useReviews = (productId: string) =>
  useInfiniteQuery({
    queryKey: ['reviews', productId],
    queryFn: ({ pageParam }) => fetchReviews(productId, pageParam, 10),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.flatMap((p) => p.items).length < last.totalCount ? pages.length + 1 : undefined),
  });

export const useMarkHelpful = (productId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, helpful }: { id: string; helpful: boolean }) => setReviewHelpful(id, helpful),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews', productId] }),
  });
};

export const useCreateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReview,
    onSuccess: (_review, input) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', input.productId] });
      queryClient.invalidateQueries({ queryKey: ['review-summary', input.productId] });
      queryClient.invalidateQueries({ queryKey: ['product', input.productId] });
      // التقييم يمنح نقاط ولاء
      queryClient.invalidateQueries({ queryKey: ['loyalty-account'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-transactions'] });
    },
  });
};

export const useMyReturns = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: ['returns'], queryFn: fetchMyReturns, enabled: signedIn });
};

export const useCreateReturn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReturn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['returns'] }),
  });
};
