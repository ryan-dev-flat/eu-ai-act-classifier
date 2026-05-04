package eu_ai_act.classification

import rego.v1

# Annex III(5) — Access to and enjoyment of essential public and private
# services and benefits.
# (a) Public authorities determining eligibility for public assistance benefits
#     and services, including healthcare, or to grant, reduce, revoke, or
#     reclaim such benefits.
# (b) Evaluating creditworthiness or establishing credit scores of natural
#     persons (excluding detection of financial fraud).
# (c) Risk assessment and pricing in life and health insurance.
# (d) Dispatching, or establishing priority in the dispatching of, emergency
#     first response services.

annex_iii_categories contains reason if {
	answer_true("determines_eligibility_for_public_benefits")
	reason := {
		"id": "annex_iii_5_a_public_benefits",
		"article": "Annex III(5)(a)",
		"summary": "Eligibility for public assistance benefits or services, incl. healthcare.",
	}
}

annex_iii_categories contains reason if {
	answer_true("used_for_creditworthiness_or_credit_scoring")
	not answer_true("detects_only_financial_fraud")
	reason := {
		"id": "annex_iii_5_b_credit_scoring",
		"article": "Annex III(5)(b)",
		"summary": "Creditworthiness evaluation or credit scoring of natural persons.",
	}
}

annex_iii_categories contains reason if {
	answer_true("used_for_life_or_health_insurance_pricing")
	reason := {
		"id": "annex_iii_5_c_insurance_pricing",
		"article": "Annex III(5)(c)",
		"summary": "Risk assessment or pricing for life or health insurance.",
	}
}

annex_iii_categories contains reason if {
	answer_true("dispatches_emergency_services")
	reason := {
		"id": "annex_iii_5_d_emergency_dispatch",
		"article": "Annex III(5)(d)",
		"summary": "Dispatching or prioritising emergency first-response services.",
	}
}
