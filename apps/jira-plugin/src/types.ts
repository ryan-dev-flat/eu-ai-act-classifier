export type RiskTier = 'prohibited' | 'high_risk' | 'limited_risk' | 'minimal_risk' | 'gpai' | 'gpai_systemic_risk';

export interface TriggeredReason {
  id?: string;
  article: string;
  summary: string;
}

export interface ClassificationResult {
  classificationId: string;
  riskTier: RiskTier;
  obligations: string[];
  rationale: string;
  openQuestions: string[];
  triggeredHighRiskReasons?: TriggeredReason[];
  suppressedHighRiskReasons?: TriggeredReason[];
  evaluatedAt: string;
}

export interface WorkflowTask {
  id: string;
  role: string;
  state?: string;
  completedAt?: string | null;
}

export interface WorkflowInstance {
  id: string;
  classificationId: string;
  state: string;
  tasks: WorkflowTask[];
}

export interface ClassificationSummary {
  issueId: string;
  issueKey: string;
  tenantId: string;
  classificationId: string | null;
  status: 'not_started' | 'classified' | 'workflow_in_progress' | 'approved' | 'rejected' | 'error';
  riskTier: RiskTier | null;
  obligations: string[];
  workflowState: string | null;
  activeTaskRole: string | null;
  rationale: string | null;
  openQuestions: string[];
  error?: string;
}

export interface LinkClassificationPayload {
  issueId?: string;
  issueKey?: string;
  classificationId: string;
}

export interface StartAssessmentPayload {
  issueId?: string;
  issueKey?: string;
  systemId: string;
  pathway?: 'standard' | 'gpai';
  domain?: string;
  templateId?: string;
  answers?: Record<string, unknown>;
}
