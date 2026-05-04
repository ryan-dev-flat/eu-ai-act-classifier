package eu_ai_act.classification

import rego.v1

# Annex III(8) — Administration of justice and democratic processes.
# (a) AI systems intended to be used by, or on behalf of, a judicial authority
#     to assist in researching and interpreting facts and the law and in
#     applying the law to a concrete set of facts, or used in a similar way in
#     alternative dispute resolution.
# (b) AI systems intended to be used for influencing the outcome of an
#     election or referendum, or the voting behaviour of natural persons in
#     the exercise of their vote in such elections or referenda. This does
#     not include AI systems whose output natural persons are not directly
#     exposed to (e.g. tools for organisation, optimisation, or campaign
#     administration).

annex_iii_categories contains reason if {
	answer_true("assists_judicial_decision_making")
	reason := {
		"id": "annex_iii_8_a_judicial_assistance",
		"article": "Annex III(8)(a)",
		"summary": "Assists judicial authority (or ADR) in interpreting and applying the law.",
	}
}

annex_iii_categories contains reason if {
	answer_true("influences_election_or_voter_behaviour")
	not answer_true("voters_not_directly_exposed_to_output")
	reason := {
		"id": "annex_iii_8_b_election_influence",
		"article": "Annex III(8)(b)",
		"summary": "Influences election/referendum outcomes or voting behaviour with direct voter exposure.",
	}
}
