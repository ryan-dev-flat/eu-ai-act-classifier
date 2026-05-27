import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { createHash } from 'node:crypto';
import type {
  ClassificationResult,
  ClassificationSummary,
  LinkClassificationPayload,
  RiskTier,
  StartAssessmentPayload,
  WorkflowInstance,
} from './types.js';
import type { WebTriggerRequest, WebTriggerResponse } from '@forge/api';

const resolver = new Resolver();
const CLASSIFICATION_FIELD_MODULE_KEY = 'eu-ai-act-classification-id';
const CLASSIFICATION_FIELD_NAME = 'EU AI Act Classification ID';

interface IssueClassificationMapping {
  tenantId?: string;
  issueId: string;
  issueKey?: string;
  classificationId?: string;
  updatedAt?: string;
}

interface AsyncIssueUpdatePayload {
  issueId?: string;
  issueKey?: string;
  tenantId?: string;
  classificationId?: string;
  riskTier?: RiskTier;
  workflowState?: string;
  approvalStatus?: string;
  message?: string;
  updatedAt?: string;
}

interface JiraField {
  id: string;
  key?: string;
  name?: string;
  schema?: { custom?: string };
}

resolver.define('getClassificationForIssue', async ({ payload, context }) => {
  const issue = resolveIssueContext(context, payload as Partial<LinkClassificationPayload> | undefined);
  const tenantId = await getTenantId(context);
  const mapping = await getIssueMapping(issue.issueId);
  if (!mapping?.classificationId) return emptySummary(issue, tenantId);
  try {
    return await loadIssueSummary(issue, context, tenantId, mapping.classificationId);
  } catch (err) {
    const summary: ClassificationSummary = {
      ...emptySummary(issue, tenantId),
      classificationId: mapping.classificationId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
    return summary;
  }
});

resolver.define('linkClassificationToIssue', async ({ payload, context }) => {
  const body = payload as LinkClassificationPayload;
  const issue = resolveIssueContext(context, body);
  const tenantId = await getTenantId(context);
  await storeIssueMapping(issue, tenantId, body.classificationId);
  await syncClassificationCustomField(issue.issueId, body.classificationId);
  return loadIssueSummary(issue, context, tenantId, body.classificationId);
});

resolver.define('startClassification', async ({ payload, context }) => {
  const body = payload as StartAssessmentPayload;
  const issue = resolveIssueContext(context, body);
  const tenantId = await getTenantId(context);
  const result = await backendJson<ClassificationResult>(
    serviceUrl('CLASSIFICATION_ENGINE_URL', '/v1/classifications'),
    context,
    tenantId,
    {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        systemId: body.systemId,
        pathway: body.pathway ?? 'standard',
        domain: body.domain ?? 'other',
        templateId: body.templateId ?? 'standard-deployer',
        submitterId: userIdFromContext(context),
        answers: normalizeAnswers(body.answers ?? {}),
      }),
    },
  );
  await storeIssueMapping(issue, tenantId, result.classificationId);
  await syncClassificationCustomField(issue.issueId, result.classificationId);
  const workflow = await tryBackendJson<WorkflowInstance>(
    serviceUrl('WORKFLOW_URL', `/v1/workflows/${result.classificationId}`),
    context,
    tenantId,
  );
  return toSummary(issue, tenantId, result, workflow);
});

resolver.define('setTenantForSite', async ({ payload, context }) => {
  const body = payload as { tenantId: string };
  const cloudId = cloudIdFromContext(context);
  await kvs.set(tenantKey(cloudId), { tenantId: body.tenantId, updatedAt: new Date().toISOString() });
  return { tenantId: body.tenantId };
});

export const handler = resolver.getDefinitions();

export const updateIssue = async (request: WebTriggerRequest): Promise<WebTriggerResponse> => {
  try {
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return jsonResponse(405, { error: 'Use POST, PUT, or PATCH to send Jira issue updates.' }, 'Method Not Allowed');
    }

    const authResponse = authenticateWebTrigger(request);
    if (authResponse) return authResponse;

    const payload = parseAsyncIssueUpdatePayload(request);
    const issue = await resolveIssueForAsyncUpdate(payload);
    if (!issue) return jsonResponse(400, { error: 'Provide issueId, issueKey, or a known classificationId.' });

    const classificationId = stringOrUndefined(payload.classificationId);
    if (classificationId) {
      const tenantId = stringOrUndefined(payload.tenantId) ?? issue.mapping?.tenantId ?? 'unknown';
      await storeIssueMapping({ issueId: issue.id, issueKey: issue.key }, tenantId, classificationId);
      await syncClassificationCustomField(issue.id, classificationId);
    }

    await addJiraUpdateComment(issue.key, formatAsyncUpdateComment(payload, issue));

    return jsonResponse(200, {
      ok: true,
      issueId: issue.id,
      issueKey: issue.key,
      classificationId: classificationId ?? issue.mapping?.classificationId ?? null,
    });
  } catch (err) {
    console.error('Failed to process EU AI Act Jira update', err);
    return jsonResponse(500, { error: err instanceof Error ? err.message : String(err) }, 'Internal Server Error');
  }
};

async function loadIssueSummary(
  issue: { issueId: string; issueKey: string },
  context: unknown,
  tenantId: string,
  classificationId: string,
): Promise<ClassificationSummary> {
  const classification = await backendJson<ClassificationResult>(
    serviceUrl('CLASSIFICATION_ENGINE_URL', `/v1/classifications/${classificationId}`),
    context,
    tenantId,
  );
  const workflow = await tryBackendJson<WorkflowInstance>(
    serviceUrl('WORKFLOW_URL', `/v1/workflows/${classificationId}`),
    context,
    tenantId,
  );
  return toSummary(issue, tenantId, classification, workflow);
}

function toSummary(
  issue: { issueId: string; issueKey: string },
  tenantId: string,
  classification: ClassificationResult,
  workflow: WorkflowInstance | null,
): ClassificationSummary {
  const activeTask = workflow?.tasks?.find((task) => !task.completedAt) ?? null;
  const workflowState = workflow?.state ?? null;
  const status: ClassificationSummary['status'] =
    workflowState === 'approved' ? 'approved' : workflowState === 'rejected' ? 'rejected' : workflow ? 'workflow_in_progress' : 'classified';
  return {
    issueId: issue.issueId,
    issueKey: issue.issueKey,
    tenantId,
    classificationId: classification.classificationId,
    status,
    riskTier: classification.riskTier,
    obligations: classification.obligations.slice(0, 5),
    workflowState,
    activeTaskRole: activeTask?.role ?? null,
    rationale: classification.rationale,
    openQuestions: classification.openQuestions,
  };
}

function emptySummary(issue: { issueId: string; issueKey: string }, tenantId: string): ClassificationSummary {
  return {
    issueId: issue.issueId,
    issueKey: issue.issueKey,
    tenantId,
    classificationId: null,
    status: 'not_started',
    riskTier: null,
    obligations: [],
    workflowState: null,
    activeTaskRole: null,
    rationale: null,
    openQuestions: [],
  };
}

async function backendJson<T>(url: string, context: unknown, tenantId: string, init: RequestInit = {}): Promise<T> {
  const res = await backendFetch(url, context, tenantId, init);
  if (!res.ok) throw new Error(`${url} returned ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function tryBackendJson<T>(url: string, context: unknown, tenantId: string): Promise<T | null> {
  try {
    return await backendJson<T>(url, context, tenantId);
  } catch {
    return null;
  }
}

async function backendFetch(url: string, context: unknown, tenantId: string, init: RequestInit) {
  const token = process.env.EU_AI_ACT_BACKEND_TOKEN;
  const headers = {
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
    ...(token ? { authorization: `Bearer ${token}` } : devAuthHeaders(context, tenantId)),
  };

  const request = forgeRequest(init, headers);
  if (!token) {
    try {
      const external = api.asUser().withProvider('eu-ai-act-backend', 'eu-ai-act-api');
      if (await external.hasCredentials()) return external.fetch(url, request as any);
    } catch {
      // Fall through to app-level fetch for dev/tunnel mode.
    }
  }
  return api.fetch(url, request as any);
}

function forgeRequest(init: RequestInit, headers: Record<string, string>): RequestInit {
  const { body, ...rest } = init;
  const base = { ...rest, headers };
  if (body === null || body === undefined) return base;
  return { ...base, body };
}

function serviceUrl(envName: 'CLASSIFICATION_ENGINE_URL' | 'WORKFLOW_URL', path: string): string {
  const root = process.env[envName] ?? process.env.EU_AI_ACT_BACKEND_URL ?? 'https://api.eu-ai-act.example.com';
  return `${root.replace(/\/$/, '')}${path}`;
}

async function getTenantId(context: unknown): Promise<string> {
  const cloudId = cloudIdFromContext(context);
  const stored = (await kvs.get(tenantKey(cloudId))) as { tenantId?: string } | undefined;
  return stored?.tenantId ?? process.env.EU_AI_ACT_DEFAULT_TENANT_ID ?? stableUuid(`tenant:${cloudId}`);
}

async function storeIssueMapping(
  issue: { issueId: string; issueKey: string },
  tenantId: string,
  classificationId: string,
): Promise<IssueClassificationMapping> {
  const mapping: IssueClassificationMapping = {
    tenantId,
    issueId: issue.issueId,
    issueKey: issue.issueKey,
    classificationId,
    updatedAt: new Date().toISOString(),
  };
  await kvs.set(mappingKey(issue.issueId), mapping);
  await kvs.set(classificationMappingKey(classificationId), mapping);
  return mapping;
}

async function syncClassificationCustomField(issueIdOrKey: string, classificationId: string): Promise<void> {
  const issue = await resolveJiraIssueIdentity(issueIdOrKey);
  const issueId = Number.parseInt(issue.id, 10);
  if (!Number.isFinite(issueId)) throw new Error(`Jira issue id ${issue.id} is not numeric.`);

  const fieldId = await getClassificationCustomFieldId();
  const response = await api.asApp().requestJira(route`/rest/api/3/app/field/${fieldId}/value`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ updates: [{ issueIds: [issueId], value: classificationId }] }),
  });
  await assertJiraOk(response, 'Update EU AI Act Classification ID custom field');
}

async function getClassificationCustomFieldId(): Promise<string> {
  const cached = (await kvs.get(classificationFieldStorageKey())) as { fieldId?: string } | undefined;
  if (cached?.fieldId) return cached.fieldId;

  const response = await api.asApp().requestJira(route`/rest/api/3/field`, { headers: { Accept: 'application/json' } });
  await assertJiraOk(response, 'List Jira fields');
  const fields = (await response.json()) as JiraField[];
  const field = fields.find(isClassificationCustomField);
  if (!field) throw new Error(`Could not find Jira custom field ${CLASSIFICATION_FIELD_NAME}. Redeploy and reinstall the Forge app.`);

  await kvs.set(classificationFieldStorageKey(), { fieldId: field.id, updatedAt: new Date().toISOString() });
  return field.id;
}

function isClassificationCustomField(field: JiraField): boolean {
  return (
    field.name === CLASSIFICATION_FIELD_NAME ||
    field.key === CLASSIFICATION_FIELD_MODULE_KEY ||
    Boolean(field.schema?.custom?.endsWith(`/static/${CLASSIFICATION_FIELD_MODULE_KEY}`))
  );
}

async function resolveIssueForAsyncUpdate(payload: AsyncIssueUpdatePayload): Promise<
  | {
      id: string;
      key: string;
      mapping?: IssueClassificationMapping;
    }
  | null
> {
  const classificationId = stringOrUndefined(payload.classificationId);
  const mapping = classificationId ? await getIssueMappingForClassification(classificationId) : undefined;
  const issueIdOrKey = stringOrUndefined(payload.issueId) ?? stringOrUndefined(payload.issueKey) ?? mapping?.issueId;
  if (!issueIdOrKey) return null;

  const identity = await resolveJiraIssueIdentity(issueIdOrKey, stringOrUndefined(payload.issueKey) ?? mapping?.issueKey);
  return { ...identity, mapping };
}

async function resolveJiraIssueIdentity(issueIdOrKey: string, knownKey?: string): Promise<{ id: string; key: string }> {
  if (/^[0-9]+$/.test(issueIdOrKey)) return { id: issueIdOrKey, key: knownKey ?? issueIdOrKey };

  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=id,key`, {
    headers: { Accept: 'application/json' },
  });
  await assertJiraOk(response, `Resolve Jira issue ${issueIdOrKey}`);
  const issue = (await response.json()) as { id?: string; key?: string };
  if (!issue.id) throw new Error(`Jira issue ${issueIdOrKey} did not return an id.`);
  return { id: String(issue.id), key: String(issue.key ?? issueIdOrKey) };
}

async function addJiraUpdateComment(issueIdOrKey: string, lines: string[]): Promise<void> {
  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}/comment`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ body: adfDocument(lines) }),
  });
  await assertJiraOk(response, 'Add EU AI Act update comment');
}

function formatAsyncUpdateComment(
  payload: AsyncIssueUpdatePayload,
  issue: { id: string; key: string; mapping?: IssueClassificationMapping },
): string[] {
  const classificationId = stringOrUndefined(payload.classificationId) ?? issue.mapping?.classificationId;
  return [
    'EU AI Act classification update received.',
    classificationId ? `Classification ID: ${classificationId}` : undefined,
    payload.riskTier ? `Risk tier: ${payload.riskTier}` : undefined,
    payload.workflowState ? `Workflow state: ${payload.workflowState}` : undefined,
    payload.approvalStatus ? `Approval status: ${payload.approvalStatus}` : undefined,
    payload.message ? `Message: ${payload.message}` : undefined,
    payload.updatedAt ? `Updated at: ${payload.updatedAt}` : undefined,
  ].filter(Boolean) as string[];
}

function authenticateWebTrigger(request: WebTriggerRequest): WebTriggerResponse | null {
  const expected = process.env.EU_AI_ACT_WEB_TRIGGER_SECRET;
  if (!expected) return jsonResponse(500, { error: 'EU_AI_ACT_WEB_TRIGGER_SECRET is not configured.' });

  const authHeader = firstHeader(request.headers, 'authorization');
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const sharedSecret = firstHeader(request.headers, 'x-eu-ai-act-secret');
  if (bearerToken === expected || sharedSecret === expected) return null;
  return jsonResponse(401, { error: 'Unauthorized' }, 'Unauthorized');
}

function parseAsyncIssueUpdatePayload(request: WebTriggerRequest): AsyncIssueUpdatePayload {
  if (!request.body) throw new Error('Request body is required.');
  const parsed = JSON.parse(request.body) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Request body must be a JSON object.');
  return parsed as AsyncIssueUpdatePayload;
}

function firstHeader(headers: Record<string, string[]>, name: string): string | undefined {
  const [value] = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? [];
  return value;
}

function jsonResponse(statusCode: number, body: unknown, statusText?: string): WebTriggerResponse {
  return {
    statusCode,
    statusText,
    headers: { 'Content-Type': ['application/json'] },
    body: JSON.stringify(body),
  };
}

function adfDocument(lines: string[]) {
  return {
    type: 'doc',
    version: 1,
    content: lines.map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })),
  };
}

async function assertJiraOk(response: { ok: boolean; status: number; text: () => Promise<string> }, action: string): Promise<void> {
  if (!response.ok) throw new Error(`${action} failed with ${response.status}: ${await response.text()}`);
}

function jsonHeaders(): Record<string, string> {
  return { Accept: 'application/json', 'Content-Type': 'application/json' };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function getIssueMapping(issueId: string): Promise<IssueClassificationMapping | undefined> {
  return (await kvs.get(mappingKey(issueId))) as IssueClassificationMapping | undefined;
}

async function getIssueMappingForClassification(classificationId: string): Promise<IssueClassificationMapping | undefined> {
  return (await kvs.get(classificationMappingKey(classificationId))) as IssueClassificationMapping | undefined;
}

function mappingKey(issueId: string): string {
  return `eu-ai-act:issue:${issueId}:classification`;
}

function classificationMappingKey(classificationId: string): string {
  return `eu-ai-act:classification:${classificationId}:issue`;
}

function classificationFieldStorageKey(): string {
  return `eu-ai-act:jira-field:${CLASSIFICATION_FIELD_MODULE_KEY}`;
}

function tenantKey(cloudId: string): string {
  return `eu-ai-act:tenant:${cloudId}`;
}

function resolveIssueContext(context: any, payload?: Partial<LinkClassificationPayload>) {
  const issue = context?.extension?.issue ?? context?.extension?.jira?.issue ?? {};
  return {
    issueId: payload?.issueId ?? String(issue.id ?? issue.issueId ?? 'unknown-issue'),
    issueKey: payload?.issueKey ?? String(issue.key ?? issue.issueKey ?? 'unknown'),
  };
}

function cloudIdFromContext(context: any): string {
  return String(context?.cloudId ?? context?.site?.cloudId ?? 'local-jira-site');
}

function userIdFromContext(context: any): string {
  return process.env.EU_AI_ACT_DEFAULT_USER_ID ?? stableUuid(`user:${String(context?.accountId ?? 'forge-user')}`);
}

function devAuthHeaders(context: unknown, tenantId: string): Record<string, string> {
  return {
    'x-tenant-id': tenantId,
    'x-user-id': userIdFromContext(context),
    'x-roles': 'admin,reviewer,submitter',
  };
}

function stableUuid(input: string): string {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  const variant = Number.parseInt(hex[16]!, 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

function normalizeAnswers(value: Record<string, unknown>) {
  if (Array.isArray(value)) return value;
  return Object.entries(value).map(([questionId, answer], sequence) => ({
    questionId,
    value: normalizeAnswerValue(answer),
    sequence,
  }));
}

function normalizeAnswerValue(value: unknown): string | number | boolean | string[] {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? '');
}
