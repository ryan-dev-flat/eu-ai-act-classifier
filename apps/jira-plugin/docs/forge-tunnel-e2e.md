# Jira Forge tunnel E2E validation

Use this checklist to validate the Jira issue panel, backend classification flow, custom field sync, and async web trigger update path against the local MVP services.

## Prerequisites

- Forge CLI installed and authenticated with access to a Jira test site.
- The Forge app installed in a development environment for that test site.
- A Jira admin has added `EU AI Act Classification ID` to the relevant issue screen.
- Dependencies are installed from the repository root with `pnpm install`.

## Local infrastructure

From the repository root:

```powershell
docker compose up -d
```

Start the service processes used by the Jira app in separate terminals:

```powershell
$env:OPA_URL="http://localhost:8181"
$env:DATABASE_URL="postgres://classifier:classifier@localhost:5432/classifier"
$env:REDIS_URL="redis://localhost:6379"
pnpm --filter "@eu-ai-act/classification-engine" run dev
pnpm --filter "@eu-ai-act/workflow" run dev
```

The Jira plugin expects the default local service URLs:

- `CLASSIFICATION_ENGINE_URL=http://localhost:4001`
- `WORKFLOW_URL=http://localhost:4002`

## Forge environment variables

Set these in the Forge development environment before tunneling:

```powershell
cd apps/jira-plugin
forge variables set CLASSIFICATION_ENGINE_URL http://localhost:4001 --environment development
forge variables set WORKFLOW_URL http://localhost:4002 --environment development
forge variables set EU_AI_ACT_BACKEND_TOKEN <dev-or-service-token> --encrypt --environment development
forge variables set EU_AI_ACT_WEB_TRIGGER_SECRET <shared-webhook-secret> --encrypt --environment development
forge variables set EU_AI_ACT_DEFAULT_TENANT_ID <tenant-uuid> --environment development
```

If you are using dev headers instead of bearer auth locally, omit `EU_AI_ACT_BACKEND_TOKEN`; the resolver will send `x-tenant-id`, `x-user-id`, and `x-roles` headers.

## Tunnel and install

```powershell
cd apps/jira-plugin
forge deploy --environment development
forge install --environment development
forge tunnel --environment development
```

Create or retrieve the web trigger URL in another terminal:

```powershell
forge webtrigger create --functionKey updateIssue --environment development
```

## Validation flow

1. Open a Jira issue in the test site.
2. Open the `EU AI Act Classification` issue panel.
3. Click `Perform Risk Assessment`, submit a minimal assessment, and wait for the panel to refresh.
4. Confirm the panel shows a `classificationId`, risk tier, obligations, and workflow state.
5. Confirm Jira's `EU AI Act Classification ID` custom field contains the same `classificationId`.
6. Send an async update to the web trigger:

```powershell
$url="<forge-webtrigger-url>"
$secret="<shared-webhook-secret>"
$body=@{
  issueKey="ABC-123"
  classificationId="<classification-id>"
  riskTier="high_risk"
  workflowState="approved"
  approvalStatus="approved"
  message="E2E tunnel validation update"
  updatedAt=(Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json

Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization="Bearer $secret" } -ContentType "application/json" -Body $body
```

7. Confirm the Jira issue receives an `EU AI Act classification update received` comment.
8. Refresh the issue and confirm the custom field still matches the classification ID.
9. Check Forge tunnel logs and service logs for errors.

## Pass criteria

- `pnpm --filter "@eu-ai-act/jira-plugin" run typecheck` exits with code 0.
- The issue panel can create or link a classification without resolver errors.
- The `EU AI Act Classification ID` custom field is populated by the app.
- The web trigger rejects invalid secrets with `401` and accepts the shared secret.
- Accepted web trigger updates add a Jira comment and preserve the issue-classification mapping.