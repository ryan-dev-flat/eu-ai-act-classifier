package eu_ai_act.classification_test

import rego.v1

import data.eu_ai_act.classification

# Helper to build a minimal intake input from a list of {questionId, value} pairs.
intake(answers) := result if {
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

# ---- Annex III(1) Biometrics ---------------------------------------------

test_biometric_categorisation_is_high_risk if {
	classification.riskTier == "high_risk" with input as intake([{"questionId": "performs_biometric_categorisation_sensitive_attributes", "value": true}])
}

test_emotion_recognition_is_high_risk if {
	classification.riskTier == "high_risk" with input as intake([{"questionId": "performs_emotion_recognition", "value": true}])
}

test_remote_biometric_id_is_high_risk if {
	classification.riskTier == "high_risk" with input as intake([{"questionId": "performs_remote_biometric_identification", "value": true}])
}

test_pure_biometric_verification_is_not_high_risk if {
	r := classification.riskTier with input as intake([
		{"questionId": "performs_remote_biometric_identification", "value": true},
		{"questionId": "performs_only_biometric_verification", "value": true},
	])
	r != "high_risk"
}

# ---- Annex III(2) Critical infrastructure --------------------------------

test_critical_infrastructure_is_high_risk if {
	classification.riskTier == "high_risk" with input as intake([
		{"questionId": "is_safety_component_of_critical_infrastructure", "value": true},
		{"questionId": "critical_infrastructure_domain", "value": "electricity_supply"},
	])
}

test_critical_infrastructure_unspecified_domain_not_high_risk if {
	r := classification.riskTier with input as intake([
		{"questionId": "is_safety_component_of_critical_infrastructure", "value": true},
		{"questionId": "critical_infrastructure_domain", "value": "none"},
	])
	r != "high_risk"
}

# ---- Annex III(4) Employment ---------------------------------------------

test_recruitment_is_high_risk if {
	classification.riskTier == "high_risk" with input as intake([{"questionId": "used_for_recruitment_or_selection", "value": true}])
}

test_legacy_recruitment_question_still_works if {
	classification.riskTier == "high_risk" with input as intake([{"questionId": "used_for_recruitment_or_promotion_decisions", "value": true}])
}

# ---- Annex III(5) Essential services -------------------------------------

test_credit_scoring_is_high_risk if {
	classification.riskTier == "high_risk" with input as intake([{"questionId": "used_for_creditworthiness_or_credit_scoring", "value": true}])
}

test_fraud_detection_only_excluded_from_credit_scoring if {
	r := classification.riskTier with input as intake([
		{"questionId": "used_for_creditworthiness_or_credit_scoring", "value": true},
		{"questionId": "detects_only_financial_fraud", "value": true},
	])
	r != "high_risk"
}
