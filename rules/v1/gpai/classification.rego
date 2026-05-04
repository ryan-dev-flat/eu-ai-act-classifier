package eu_ai_act.classification

import rego.v1

# GPAI pathway (Article 51 et seq.). Systemic-risk threshold per recital is
# 10^25 FLOP cumulative training compute.

gpai_match if {
	input.pathway == "gpai"
}

gpai_systemic_risk_match if {
	gpai_match
	some i
	input.answers[i].questionId == "training_compute_flops"
	to_number(input.answers[i].value) >= 1e25
}
