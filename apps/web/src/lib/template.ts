import standardDeployer from '../../../../rules/templates/standard-deployer.json';

/**
 * Question type as it appears in `rules/templates/*.json`. Mirrors the schema
 * used by OPA inputs so the wizard can submit answers without extra mapping.
 */
export type TemplateQuestion = {
  id: string;
  label: string;
  required?: boolean;
} & (
  | { type: 'boolean' }
  | { type: 'single_select'; options: string[] }
  | { type: 'multi_select'; options: string[] }
  | { type: 'text' }
);

export interface TemplateSection {
  id: string;
  title: string;
  rationale?: string;
  questions: TemplateQuestion[];
}

export interface IntakeTemplate {
  templateId: string;
  domain: string;
  name: string;
  version: string;
  description: string;
  sections: TemplateSection[];
}

export const STANDARD_DEPLOYER_TEMPLATE = standardDeployer as unknown as IntakeTemplate;

export function getTemplate(_id: string): IntakeTemplate {
  // Only one template is exposed in the MVP. Stable signature for when we add
  // domain-specific templates (hr-tech, fintech).
  return STANDARD_DEPLOYER_TEMPLATE;
}
