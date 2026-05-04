import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getClassificationForIssue', async ({ payload, context }) => {
  // Look up classification status for the current Jira issue.
  // Implementation pending — proxies to the classification-engine service.
  return {
    issueKey: context.extension?.issue?.key,
    status: 'not_started',
    riskTier: null,
  };
});

resolver.define('startClassification', async ({ payload }) => {
  // Open the intake questionnaire pre-populated with Jira issue metadata.
  return { ok: true, payload };
});

export const handler = resolver.getDefinitions();
