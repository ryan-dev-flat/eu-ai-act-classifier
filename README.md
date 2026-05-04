# EU AI Act Risk Classifier — MVP

Multi-tenant SaaS platform for EU AI Act risk classification, obligation tracking,
and August 2026 readiness reporting. See `architecture_eu_ai_act_risk_classifier.md`
in the repo root for the full architecture document.

## Repository layout

```
eu-ai-act-classifier/
├── apps/
│   ├── web/                     # Next.js 14 App Router frontend
│   └── jira-plugin/             # Atlassian Forge plugin
├── services/
│   ├── classification-engine/   # §3.1 — rule evaluation
│   ├── workflow/                # §3.2 — approval chains
│   ├── regulatory-intelligence/ # §3.3 — obligation catalog, change log
│   ├── timeline/                # §3.4 — deadline + readiness
│   ├── audit-log/               # §3.7 — append-only event store
│   ├── notification/            # §3.8 — email / Slack / Teams
│   ├── tenant-identity/         # §3.9 — RBAC, OIDC/SAML
│   └── export/                  # §3.6 — PDF / Markdown generation
├── packages/
│   ├── shared-types/            # cross-service TS types
│   ├── db/                      # Postgres client, migrations, seeds
│   ├── audit-client/            # write-ahead audit event helper
│   ├── auth/                    # JWT/OIDC verification utilities
│   └── config/                  # zod-validated env loader
├── rules/                       # versioned OPA / YAML rule sets
├── content/                     # regulatory content seed data
├── db/migrations/               # SQL migrations (numbered)
├── infra/
│   ├── terraform/               # AWS infra (RDS, EKS, S3, ElastiCache, OpenSearch)
│   ├── helm/classifier/         # Helm chart for K8s deployment
│   └── opa/                     # OPA bundle build
└── .github/workflows/           # CI + rules content pipeline
```

## Local development

Requirements: Node 20+, pnpm 9+, Docker.

```bash
cp .env.example .env
pnpm install
pnpm infra:up       # postgres, redis, opa, minio, mailhog
pnpm db:migrate
pnpm db:seed
pnpm dev            # runs all services + web in parallel
```

Service ports (local) are listed in `.env.example`.

## MVP scope (Phase 1)

Per architecture §9, the MVP delivers:

- Standard deployer pathway with HR tech + fintech intake templates
- GPAI pathway: intake, obligation list, Code of Practice text
- 2-step approval workflow with email notifications
- August 2026 readiness dashboard with traffic-light per system
- Enforcement Authority Mapper (EU-level + available national)
- Business Risk Summary Card
- Write-ahead audit log
- Classification memo PDF + readiness report PDF
- Jira plugin (basic) + Google/Microsoft SSO
- Manual rule update admin interface

Phases 1.5 and 2 are tracked as future work; their service boundaries are already
in place but the corresponding handlers are stubbed.
