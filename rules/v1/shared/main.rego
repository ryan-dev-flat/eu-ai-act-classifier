package eu_ai_act.classification

import rego.v1

# Top-level decision combining the per-tier rule files. The classification
# engine queries `data.eu_ai_act.classification` and reads
# `riskTier`, `obligations`, `confidence`, `openQuestions`, `rationale`,
# and the structured `triggered_high_risk_reasons` set.

default riskTier := "minimal_risk"

default obligations := []

default confidence := 0.5

default rationale := "No matching rule fired; defaulted to minimal risk."

riskTier := "prohibited" if prohibited_match

riskTier := "gpai_systemic_risk" if {
	not prohibited_match
	gpai_systemic_risk_match
}

riskTier := "gpai" if {
	not prohibited_match
	not gpai_systemic_risk_match
	gpai_match
}

riskTier := "high_risk" if {
	not prohibited_match
	not gpai_match
	high_risk_match
}

riskTier := "limited_risk" if {
	not prohibited_match
	not gpai_match
	not high_risk_match
	limited_risk_match
}

# Obligations are looked up from a static tier->[obligation_id] map. The
# Regulatory Intelligence Service is the source of truth for obligation
# content; here we just emit the ids the classification engine returns.
obligations_by_tier := {
	"prohibited": [],
	"high_risk": [
		"art9_risk_management",
		"art10_data_governance",
		"art13_transparency_to_deployers",
		"art26_deployer_obligations",
	],
	"limited_risk": ["art50_transparency"],
	"minimal_risk": [],
	"gpai": ["art53_gpai_provider_obligations"],
	"gpai_systemic_risk": [
		"art53_gpai_provider_obligations",
		"art55_gpai_systemic_risk",
	],
}

obligations := obligations_by_tier[riskTier]

# Rationale composed from the triggered category articles when high-risk.
# Articles are sorted for stable, deterministic output.
rationale := msg if {
	riskTier == "high_risk"
	articles := sort([r.article | some r in triggered_high_risk_reasons])
	count(articles) > 0
	msg := sprintf("High-risk match under: %s.", [concat(", ", articles)])
}

rationale := "Article 5 prohibited practice triggered." if riskTier == "prohibited"

rationale := "Article 50 transparency obligations apply." if riskTier == "limited_risk"

rationale := "GPAI pathway under Article 53." if riskTier == "gpai"

rationale := "GPAI with systemic risk under Article 55 (>= 1e25 FLOP training compute)." if {
	riskTier == "gpai_systemic_risk"
}

# Confidence: 1.0 when a rule fired with no derogation ambiguity, 0.6 when
# the derogation answers are missing on an Annex III match, 0.5 default.
confidence := 1.0 if riskTier == "prohibited"

confidence := 1.0 if {
	riskTier == "high_risk"
	derogation_questions_complete
}

confidence := 0.6 if {
	riskTier == "high_risk"
	not derogation_questions_complete
}

confidence := 0.9 if riskTier == "limited_risk"

confidence := 0.9 if riskTier == "gpai"

confidence := 0.9 if riskTier == "gpai_systemic_risk"

derogation_questions_complete if {
	answered("performs_narrow_procedural_task")
	answered("improves_result_of_prior_human_activity")
	answered("detects_decision_patterns_with_human_review")
	answered("performs_preparatory_task_only")
	answered("performs_profiling_of_natural_persons")
}

derogation_question_ids := [
	"performs_narrow_procedural_task",
	"improves_result_of_prior_human_activity",
	"detects_decision_patterns_with_human_review",
	"performs_preparatory_task_only",
	"performs_profiling_of_natural_persons",
]

# Open questions — Article 6(3) derogation answers that are missing while an
# Annex III match exists. Reviewers must complete these to obtain a confident
# high-risk classification or a documented exemption.
openQuestions := [q |
	count(annex_iii_categories) > 0
	some q in derogation_question_ids
	answer_missing(q)
]
