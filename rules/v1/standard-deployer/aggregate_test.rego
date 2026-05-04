package eu_ai_act.classification_test

import rego.v1

import data.eu_ai_act.classification

mk(answers) := result if {
	indexed := [{"questionId": a.questionId, "value": a.value, "sequence": i} |
		some i, a in answers
	]
	result := {
		"tenantId": "00000000-0000-0000-0000-000000000000",
		"systemId": "11111111-1111-1111-1111-111111111111",
		"pathway": "standard",
		"domain": "other",
		"templateId": "standard-deployer-v1",
		"answers": indexed,
		"submitterId": "22222222-2222-2222-2222-222222222222",
	}
}

# Default: no answers => minimal risk.
test_default_minimal_risk if {
	classification.riskTier == "minimal_risk" with input as mk([])
}

# Prohibited beats high-risk.
test_prohibited_beats_high_risk if {
	classification.riskTier == "prohibited" with input as mk([
		{"questionId": "social_scoring_by_public_authority", "value": true},
		{"questionId": "used_for_recruitment_or_selection", "value": true},
	])
}

# High-risk obligations include Articles 9, 10, 13, 26.
test_high_risk_obligations if {
	"art9_risk_management" == classification.obligations[_] with input as mk([{"questionId": "used_for_recruitment_or_selection", "value": true}])
	"art13_transparency_to_deployers" == classification.obligations[_] with input as mk([{"questionId": "used_for_recruitment_or_selection", "value": true}])
}

# Limited-risk obligations include Article 50.
test_limited_risk_obligations if {
	classification.obligations[_] == "art50_transparency" with input as mk([{"questionId": "interacts_with_natural_persons", "value": true}])
}

# Rationale mentions the matched articles for high-risk.
test_high_risk_rationale_mentions_article if {
	contains(classification.rationale, "Annex III(4)") with input as mk([{"questionId": "used_for_recruitment_or_selection", "value": true}])
}

# Multiple Annex III categories triggered are all surfaced.
test_multiple_categories_aggregated if {
	count(classification.triggered_high_risk_reasons) >= 2 with input as mk([
		{"questionId": "used_for_recruitment_or_selection", "value": true},
		{"questionId": "performs_emotion_recognition", "value": true},
	])
}

# Annex I safety component triggers high-risk.
test_annex_i_safety_component_high_risk if {
	classification.riskTier == "high_risk" with input as mk([
		{"questionId": "is_safety_component_under_annex_i", "value": true},
		{"questionId": "annex_i_legislation", "value": "medical_devices_reg_2017_745"},
		{"questionId": "requires_third_party_conformity_assessment", "value": true},
	])
}

# GPAI pathway with low compute -> gpai (not systemic).
test_gpai_below_threshold if {
	r := classification.riskTier with input as {
		"tenantId": "00000000-0000-0000-0000-000000000000",
		"systemId": "11111111-1111-1111-1111-111111111111",
		"pathway": "gpai",
		"domain": "other",
		"templateId": "gpai-v1",
		"answers": [{"questionId": "training_compute_flops", "value": 1e23, "sequence": 0}],
		"submitterId": "22222222-2222-2222-2222-222222222222",
	}
	r == "gpai"
}

# GPAI pathway above threshold -> systemic risk.
test_gpai_systemic_risk if {
	r := classification.riskTier with input as {
		"tenantId": "00000000-0000-0000-0000-000000000000",
		"systemId": "11111111-1111-1111-1111-111111111111",
		"pathway": "gpai",
		"domain": "other",
		"templateId": "gpai-v1",
		"answers": [{"questionId": "training_compute_flops", "value": 1e26, "sequence": 0}],
		"submitterId": "22222222-2222-2222-2222-222222222222",
	}
	r == "gpai_systemic_risk"
}
