package eu_ai_act.classification

import rego.v1

# Annex III(4) — Employment, workers management and access to self-employment.
# (a) Recruitment or selection of natural persons, in particular to place
#     targeted job advertisements, analyse and filter applications, and
#     evaluate candidates.
# (b) Decisions affecting terms of work-related relationships, promotion or
#     termination, allocation of tasks based on individual behaviour or
#     personal traits or characteristics, or to monitor and evaluate the
#     performance and behaviour of persons in such relationships.

annex_iii_categories contains reason if {
	answer_true("used_for_recruitment_or_selection")
	reason := {
		"id": "annex_iii_4_a_recruitment",
		"article": "Annex III(4)(a)",
		"summary": "Recruitment or selection of natural persons (advertising, filtering, evaluation).",
	}
}

annex_iii_categories contains reason if {
	answer_true("used_for_promotion_termination_or_task_allocation")
	reason := {
		"id": "annex_iii_4_b_promotion_termination",
		"article": "Annex III(4)(b)",
		"summary": "Affects work-relationship terms, promotion, termination, or task allocation.",
	}
}

annex_iii_categories contains reason if {
	answer_true("monitors_or_evaluates_worker_performance")
	reason := {
		"id": "annex_iii_4_b_performance_monitoring",
		"article": "Annex III(4)(b)",
		"summary": "Monitors and evaluates performance or behaviour of persons in work relationships.",
	}
}

# Backwards compatibility with the existing v0 question id used by the
# hr-tech template. Maps to Annex III(4)(a) when set.
annex_iii_categories contains reason if {
	answer_true("used_for_recruitment_or_promotion_decisions")
	reason := {
		"id": "annex_iii_4_a_recruitment",
		"article": "Annex III(4)(a)",
		"summary": "Recruitment, promotion, or termination decisions (legacy template question).",
	}
}
