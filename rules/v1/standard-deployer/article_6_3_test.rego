package eu_ai_act.classification_test

import rego.v1

import data.eu_ai_act.classification

intake_with(answers) := result if {
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

# Article 6(3) — narrow procedural task derogation.
test_narrow_procedural_task_derogates if {
	r := classification.riskTier with input as intake_with([
		{"questionId": "used_for_recruitment_or_selection", "value": true},
		{"questionId": "performs_narrow_procedural_task", "value": true},
		{"questionId": "performs_profiling_of_natural_persons", "value": false},
	])
	r != "high_risk"
}

# Improves prior human activity derogation.
test_improves_prior_human_activity_derogates if {
	r := classification.riskTier with input as intake_with([
		{"questionId": "used_for_recruitment_or_selection", "value": true},
		{"questionId": "improves_result_of_prior_human_activity", "value": true},
		{"questionId": "performs_profiling_of_natural_persons", "value": false},
	])
	r != "high_risk"
}

# Preparatory task derogation.
test_preparatory_task_derogates if {
	r := classification.riskTier with input as intake_with([
		{"questionId": "used_for_creditworthiness_or_credit_scoring", "value": true},
		{"questionId": "performs_preparatory_task_only", "value": true},
		{"questionId": "performs_profiling_of_natural_persons", "value": false},
	])
	r != "high_risk"
}

# Pattern-detection derogation requires proper human review.
test_pattern_detection_without_review_no_derogation if {
	classification.riskTier == "high_risk" with input as intake_with([
		{"questionId": "used_for_recruitment_or_selection", "value": true},
		{"questionId": "detects_decision_patterns_with_human_review", "value": true},
		{"questionId": "subject_to_proper_human_review", "value": false},
	])
}

# Profiling carve-out: derogation does not apply.
test_profiling_carveout_overrides_derogation if {
	classification.riskTier == "high_risk" with input as intake_with([
		{"questionId": "used_for_recruitment_or_selection", "value": true},
		{"questionId": "performs_narrow_procedural_task", "value": true},
		{"questionId": "performs_profiling_of_natural_persons", "value": true},
	])
}

# Open questions surface when derogation answers are missing.
test_open_questions_listed_when_incomplete if {
	count(classification.openQuestions) > 0 with input as intake_with([{"questionId": "used_for_recruitment_or_selection", "value": true}])
}

# Confidence is reduced when derogation answers are incomplete.
test_confidence_reduced_when_incomplete if {
	classification.confidence == 0.6 with input as intake_with([{"questionId": "used_for_recruitment_or_selection", "value": true}])
}

# Confidence is full when all derogation questions answered (and none derogate).
test_confidence_full_when_complete if {
	classification.confidence == 1.0 with input as intake_with([
		{"questionId": "used_for_recruitment_or_selection", "value": true},
		{"questionId": "performs_narrow_procedural_task", "value": false},
		{"questionId": "improves_result_of_prior_human_activity", "value": false},
		{"questionId": "detects_decision_patterns_with_human_review", "value": false},
		{"questionId": "performs_preparatory_task_only", "value": false},
		{"questionId": "performs_profiling_of_natural_persons", "value": false},
	])
}
