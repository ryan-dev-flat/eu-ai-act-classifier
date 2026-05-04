'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ClassificationIntake,
  ClassificationResult,
} from '@eu-ai-act/shared-types';
import { apiFetch } from './api';

/**
 * Hook to submit an intake to /api/classifications. Returns the persisted
 * ClassificationResult on success. The wizard navigates to
 * `/classifications/[id]` using `data.classificationId`.
 */
export function useCreateClassification() {
  return useMutation<ClassificationResult, Error, ClassificationIntake>({
    mutationFn: (intake) =>
      apiFetch<ClassificationResult>('/api/classifications', {
        method: 'POST',
        body: JSON.stringify(intake),
      }),
  });
}

export function useClassification(id: string | undefined) {
  return useQuery<ClassificationResult>({
    queryKey: ['classification', id],
    queryFn: () => apiFetch<ClassificationResult>(`/api/classifications/${id}`),
    enabled: Boolean(id),
  });
}
