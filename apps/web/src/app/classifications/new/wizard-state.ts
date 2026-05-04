import type {
  ClassificationIntake,
  ClassificationPathway,
} from '@eu-ai-act/shared-types';

export type WizardDomain = ClassificationIntake['domain'];

export type AnswerValue = boolean | string | number | string[];

export interface WizardState {
  step: 1 | 2 | 3 | 4;
  pathway: ClassificationPathway;
  systemId: string;
  domain: WizardDomain;
  answers: Record<string, AnswerValue>;
}

export const initialState: WizardState = {
  step: 1,
  pathway: 'standard',
  systemId: '',
  domain: 'other',
  answers: {},
};

/**
 * Builds an intake payload from the wizard state. tenantId/submitterId are
 * stamped server-side from the auth context, but the schema requires them, so
 * we send placeholders that the API will overwrite.
 */
export function toIntake(state: WizardState): ClassificationIntake {
  const placeholderUuid = '00000000-0000-0000-0000-000000000000';
  return {
    tenantId: placeholderUuid,
    submitterId: placeholderUuid,
    systemId: state.systemId,
    pathway: state.pathway,
    domain: state.domain,
    templateId:
      state.pathway === 'gpai' ? 'gpai-v1' : 'standard-deployer-v1',
    answers: Object.entries(state.answers).map(([questionId, value], i) => ({
      questionId,
      value,
      sequence: i,
    })),
  };
}
