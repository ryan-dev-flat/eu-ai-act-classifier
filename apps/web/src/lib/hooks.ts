'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ClassificationIntake,
  ClassificationResult,
  Obligation,
  EnforcementAuthority,
  EnforcementMilestone,
  PortfolioReadiness,
  SystemReadiness,
  CreateExportRequest,
  ExportRecord,
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

/* ── Regulatory Intelligence hooks ── */

export function useObligations(riskTier?: string, role?: string) {
  const params = new URLSearchParams();
  if (riskTier) params.set('riskTier', riskTier);
  if (role) params.set('role', role);
  return useQuery<{ version: string; obligations: Obligation[] }>({
    queryKey: ['obligations', riskTier, role],
    queryFn: () => apiFetch(`/api/regulations/obligations?${params.toString()}`),
  });
}

export function useEnforcementMap(memberState?: string) {
  const params = new URLSearchParams();
  if (memberState) params.set('memberState', memberState);
  return useQuery<{ version: string; authorities: EnforcementAuthority[] }>({
    queryKey: ['enforcement-map', memberState],
    queryFn: () => apiFetch(`/api/regulations/enforcement-map?${params.toString()}`),
  });
}

export function useTimelineCalendar() {
  return useQuery<{ version: string; milestones: EnforcementMilestone[] }>({
    queryKey: ['timeline-calendar'],
    queryFn: () => apiFetch('/api/timeline/calendar'),
  });
}

/* ── Timeline / Readiness hooks ── */

export function usePortfolioReadiness() {
  return useQuery<PortfolioReadiness>({
    queryKey: ['portfolio-readiness'],
    queryFn: () => apiFetch('/api/timeline/portfolio'),
  });
}

export function useSystemReadiness(classificationId: string | undefined) {
  return useQuery<SystemReadiness>({
    queryKey: ['system-readiness', classificationId],
    queryFn: () => apiFetch(`/api/timeline/system/${classificationId}`),
    enabled: Boolean(classificationId),
  });
}

export function useAug2026Report() {
  return useQuery<{
    generatedAt: string;
    deadline: string;
    daysRemaining: number;
    summary: { total: number; red: number; amber: number; green: number };
    atRiskSystems: Array<{
      classificationId: string;
      systemName: string;
      riskTier: string;
      overallReadiness: string;
      openQuestions: number;
      overdueObligations: string[];
      upcomingObligations: string[];
    }>;
  }>({
    queryKey: ['aug2026-report'],
    queryFn: () => apiFetch('/api/timeline/report/aug2026'),
  });
}

export function useCreateExport() {
  return useMutation<ExportRecord, Error, CreateExportRequest>({
    mutationFn: (request) =>
      apiFetch<ExportRecord>('/api/exports', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  });
}
