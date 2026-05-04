package eu_ai_act.classification

import rego.v1

# Article 6(3) — Derogation from Annex III high-risk classification.
# An AI system referred to in Annex III shall NOT be considered high-risk where
# it does not pose a significant risk of harm to the health, safety or
# fundamental rights of natural persons, including by not materially
# influencing the outcome of decision-making. That condition is met when one
# or more of (a)–(d) below is fulfilled.
#
# Carve-out: the derogation does NOT apply if the system performs profiling
# of natural persons (Article 6(3) second subparagraph). In that case the
# system is high-risk regardless of (a)–(d).

article_6_3_condition_met if {
	answer_true("performs_narrow_procedural_task")
}

article_6_3_condition_met if {
	answer_true("improves_result_of_prior_human_activity")
}

article_6_3_condition_met if {
	answer_true("detects_decision_patterns_with_human_review")

	# (c) requires that the system "is not meant to replace or influence the
	# previously completed human assessment, without proper human review."
	answer_true("subject_to_proper_human_review")
}

article_6_3_condition_met if {
	answer_true("performs_preparatory_task_only")
}

# Profiling carve-out: if the system profiles natural persons, the Article 6(3)
# derogation is unavailable.
article_6_3_profiling_carveout if {
	answer_true("performs_profiling_of_natural_persons")
}

# A classification is exempt from high-risk only when at least one (a)–(d)
# condition is met AND the profiling carve-out does not apply.
article_6_3_exempt if {
	article_6_3_condition_met
	not article_6_3_profiling_carveout
}
