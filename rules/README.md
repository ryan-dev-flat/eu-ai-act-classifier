# Rules Store

Versioned rule sets evaluated by Open Policy Agent (OPA). Per architecture §3.1
and §4.2, rule sets are data — not code — and are promoted via the content
pipeline (`.github/workflows/rules-pipeline.yml`).

## Layout

```
rules/
├── v1/
│   ├── meta.yaml                                    # version metadata, effective dates
│   ├── shared/
│   │   ├── answers.rego                             # answer-accessor helpers
│   │   └── main.rego                                # riskTier / obligations / rationale / confidence / openQuestions
│   ├── standard-deployer/                           # Article 6 standard pathway
│   │   ├── prohibited.rego                          # Article 5
│   │   ├── annex_i_safety_component.rego            # Article 6(1) + Annex I
│   │   ├── annex_iii_1_biometrics.rego              # Annex III(1)
│   │   ├── annex_iii_2_critical_infrastructure.rego # Annex III(2)
│   │   ├── annex_iii_3_education.rego               # Annex III(3)
│   │   ├── annex_iii_4_employment.rego              # Annex III(4)
│   │   ├── annex_iii_5_essential_services.rego     # Annex III(5)
│   │   ├── annex_iii_6_law_enforcement.rego        # Annex III(6)
│   │   ├── annex_iii_7_migration.rego              # Annex III(7)
│   │   ├── annex_iii_8_justice_democracy.rego      # Annex III(8)
│   │   ├── article_6_3_derogation.rego             # Article 6(3) exemption
│   │   ├── high_risk.rego                          # aggregates Annex III/I + applies derogation
│   │   ├── limited_risk.rego                       # Article 50
│   │   ├── annex_iii_test.rego                     # per-category tests
│   │   ├── article_6_3_test.rego                   # derogation tests
│   │   └── aggregate_test.rego                     # end-to-end riskTier tests
│   └── gpai/
│       └── classification.rego                     # Articles 51–55
└── templates/                                      # intake questionnaire templates (JSON)
    ├── standard-deployer.json                      # Annex III + Article 6(3) screener
    ├── hr-tech.json
    ├── fintech.json
    └── gpai.json
```

All rule files share package `eu_ai_act.classification` and `import rego.v1`.
OPA loads the directory tree at `/policies` (see `docker-compose.yml`); the
classification engine queries `data.eu_ai_act.classification` and reads
`riskTier`, `obligations`, `rationale`, `confidence`, `openQuestions`, and the
structured `triggered_high_risk_reasons` set.

## Local validation

```powershell
# Download OPA once (Windows)
New-Item -ItemType Directory -Force -Path .tools | Out-Null
Invoke-WebRequest -Uri https://openpolicyagent.org/downloads/v0.68.0/opa_windows_amd64.exe -OutFile .tools/opa.exe

# Format, type-check, test
.\.tools\opa.exe fmt -w rules/v1/
.\.tools\opa.exe check rules/v1/
.\.tools\opa.exe test rules/v1/ -v
```
