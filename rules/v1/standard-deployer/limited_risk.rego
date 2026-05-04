package eu_ai_act.classification

import rego.v1

# Article 50 transparency obligations.
limited_risk_match if {
	input.answers[_].questionId == "interacts_with_natural_persons"
	input.answers[_].value == true
}

limited_risk_match if {
	input.answers[_].questionId == "generates_synthetic_content"
	input.answers[_].value == true
}

limited_risk_match if {
	input.answers[_].questionId == "performs_emotion_recognition"
	input.answers[_].value == true
}
