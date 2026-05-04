package eu_ai_act.classification

import rego.v1

# Prohibited practices (Article 5). Skeleton — extend with the full Article 5
# fact pattern in the implementation phase.

prohibited_match if {
	input.answers[_].questionId == "uses_subliminal_techniques"
	input.answers[_].value == true
}

prohibited_match if {
	input.answers[_].questionId == "social_scoring_by_public_authority"
	input.answers[_].value == true
}

prohibited_match if {
	input.answers[_].questionId == "real_time_remote_biometric_id_public_space"
	input.answers[_].value == true
}
