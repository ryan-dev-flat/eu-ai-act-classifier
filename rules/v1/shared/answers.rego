package eu_ai_act.classification

import rego.v1

# Answer accessors. Intake answers are an array of {questionId, value, sequence}
# objects; these helpers bind a single answer index per evaluation so multi-fact
# rules cannot accidentally pair questionId from one answer with value from
# another.

# Returns the value of the answer with the given questionId, undefined if
# the question was not answered.
answer(qid) := value if {
	some i
	input.answers[i].questionId == qid
	value := input.answers[i].value
}

# True when the question was answered with literal boolean true.
answer_true(qid) if {
	answer(qid) == true
}

# True when the question was answered with literal boolean false.
answer_false(qid) if {
	answer(qid) == false
}

# True when the answer to qid is one of the supplied options (multi-select or
# single-select with string values).
answer_in(qid, options) if {
	some i
	input.answers[i].questionId == qid
	input.answers[i].value == options[_]
}

# True when at least one of the answer's array values intersects with options.
answer_any_of(qid, options) if {
	some i
	input.answers[i].questionId == qid
	is_array(input.answers[i].value)
	input.answers[i].value[_] == options[_]
}

# True when the question has not been answered. Used to compute openQuestions.
answer_missing(qid) if {
	not answered(qid)
}

answered(qid) if {
	some i
	input.answers[i].questionId == qid
}

# Required-question reporting: the standard-deployer pathway must answer this
# screener set. main.rego subtracts the answered set from this and surfaces the
# difference in `openQuestions`.
required_screener_questions := {
	"uses_subliminal_techniques",
	"social_scoring_by_public_authority",
	"real_time_remote_biometric_id_public_space",
	"is_safety_component_of_annex_i_product",
	"annex_iii_category",
	"art6_narrow_procedural_task",
	"art6_improves_prior_human_activity",
	"art6_detects_decision_patterns_no_replace",
	"art6_preparatory_task",
	"art6_performs_profiling",
}
