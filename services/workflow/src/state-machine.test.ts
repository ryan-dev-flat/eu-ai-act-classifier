import { describe, expect, it } from 'vitest';
import type { ClassificationResult } from '@eu-ai-act/shared-types';
import {
  CHAIN_REGISTRY,
  chainForResult,
  isTerminal,
  transition,
} from './state-machine.js';

const baseResult: ClassificationResult = {
  classificationId: '11111111-1111-1111-1111-111111111111',
  riskTier: 'high_risk',
  obligations: [],
  ruleSetVersion: 'v1',
  confidence: 1,
  openQuestions: [],
  rationale: '',
  triggeredHighRiskReasons: [],
  suppressedHighRiskReasons: [],
  evaluatedAt: '2025-01-15T10:00:00.000Z',
};

describe('chainForResult', () => {
  it('selects the high-risk chain for high_risk', () => {
    expect(chainForResult(baseResult)?.id).toBe('high-risk-default-v1');
  });

  it('selects the gpai chain for gpai', () => {
    expect(chainForResult({ ...baseResult, riskTier: 'gpai' })?.id).toBe('gpai-default-v1');
  });

  it('selects the systemic-risk chain for gpai_systemic_risk', () => {
    expect(chainForResult({ ...baseResult, riskTier: 'gpai_systemic_risk' })?.id).toBe(
      'gpai-systemic-default-v1',
    );
  });

  it('returns null for limited / minimal / prohibited tiers', () => {
    expect(chainForResult({ ...baseResult, riskTier: 'limited_risk' })).toBeNull();
    expect(chainForResult({ ...baseResult, riskTier: 'minimal_risk' })).toBeNull();
    expect(chainForResult({ ...baseResult, riskTier: 'prohibited' })).toBeNull();
  });

  it('every produced chain id resolves through CHAIN_REGISTRY', () => {
    for (const id of ['high-risk-default-v1', 'gpai-default-v1', 'gpai-systemic-default-v1']) {
      expect(CHAIN_REGISTRY[id]?.id).toBe(id);
    }
  });
});

describe('transition', () => {
  it('approve on a single-step chain transitions pending -> approved', () => {
    const next = transition({
      state: 'pending',
      currentStep: 0,
      totalSteps: 1,
      actorRole: 'legal',
      requiredRole: 'legal',
      action: 'approve',
    });
    expect(next).toEqual({
      nextState: 'approved',
      nextStep: 1,
      completeCurrentTask: true,
      createNextTask: false,
    });
  });

  it('approve on the first step of a two-step chain stays in_review and creates the next task', () => {
    const next = transition({
      state: 'pending',
      currentStep: 0,
      totalSteps: 2,
      actorRole: 'governance',
      requiredRole: 'governance',
      action: 'approve',
    });
    expect(next.nextState).toBe('in_review');
    expect(next.nextStep).toBe(1);
    expect(next.completeCurrentTask).toBe(true);
    expect(next.createNextTask).toBe(true);
  });

  it('reject transitions to rejected regardless of step count', () => {
    const next = transition({
      state: 'pending',
      currentStep: 0,
      totalSteps: 2,
      actorRole: 'legal',
      requiredRole: 'legal',
      action: 'reject',
    });
    expect(next.nextState).toBe('rejected');
    expect(next.completeCurrentTask).toBe(true);
    expect(next.createNextTask).toBe(false);
  });

  it('admin can act on behalf of any reviewer role', () => {
    const next = transition({
      state: 'pending',
      currentStep: 0,
      totalSteps: 1,
      actorRole: 'admin',
      requiredRole: 'legal',
      action: 'approve',
    });
    expect(next.nextState).toBe('approved');
  });

  it('rejects an actor whose role does not match the active step', () => {
    expect(() =>
      transition({
        state: 'pending',
        currentStep: 0,
        totalSteps: 1,
        actorRole: 'governance',
        requiredRole: 'legal',
        action: 'approve',
      }),
    ).toThrowError(/cannot approve/);
  });

  it('comment leaves state and step unchanged', () => {
    const next = transition({
      state: 'in_review',
      currentStep: 1,
      totalSteps: 2,
      actorRole: 'privacy',
      requiredRole: 'legal',
      action: 'comment',
    });
    expect(next).toEqual({
      nextState: 'in_review',
      nextStep: 1,
      completeCurrentTask: false,
      createNextTask: false,
    });
  });

  it('throws when the workflow is already terminal', () => {
    expect(() =>
      transition({
        state: 'approved',
        currentStep: 1,
        totalSteps: 1,
        actorRole: 'legal',
        requiredRole: 'legal',
        action: 'approve',
      }),
    ).toThrowError(/approved/);
  });

  it('isTerminal recognises terminal states', () => {
    expect(isTerminal('approved')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('in_review')).toBe(false);
    expect(isTerminal('escalated')).toBe(false);
  });
});
