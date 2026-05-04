package eu_ai_act.classification

import rego.v1

# Annex III(3) — Education and vocational training.
# (a) Determining access, admission, or assignment to educational institutions
#     at all levels.
# (b) Evaluating learning outcomes, including those used to steer the learning
#     process.
# (c) Assessing the appropriate level of education an individual will receive
#     or be able to access.
# (d) Monitoring and detecting prohibited behaviour of students during tests.

annex_iii_categories contains reason if {
	answer_true("determines_education_access_or_admission")
	reason := {
		"id": "annex_iii_3_a_education_access",
		"article": "Annex III(3)(a)",
		"summary": "Determines access, admission, or assignment to education or training.",
	}
}

annex_iii_categories contains reason if {
	answer_true("evaluates_learning_outcomes")
	reason := {
		"id": "annex_iii_3_b_learning_outcomes",
		"article": "Annex III(3)(b)",
		"summary": "Evaluates learning outcomes, including to steer the learning process.",
	}
}

annex_iii_categories contains reason if {
	answer_true("assesses_education_level")
	reason := {
		"id": "annex_iii_3_c_education_level",
		"article": "Annex III(3)(c)",
		"summary": "Assesses the appropriate level of education for a natural person.",
	}
}

annex_iii_categories contains reason if {
	answer_true("monitors_test_taking_behaviour")
	reason := {
		"id": "annex_iii_3_d_test_monitoring",
		"article": "Annex III(3)(d)",
		"summary": "Monitors and detects prohibited behaviour of students during tests.",
	}
}
