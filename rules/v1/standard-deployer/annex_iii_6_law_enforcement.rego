package eu_ai_act.classification

import rego.v1

# Annex III(6) — Law enforcement (in so far as their use is permitted under
# applicable Union or national law).
# (a) Risk assessment of a natural person becoming a victim of criminal
#     offences.
# (b) Polygraphs and similar tools.
# (c) Evaluating the reliability of evidence in the investigation or
#     prosecution of criminal offences.
# (d) Assessing the risk of a natural person offending or re-offending, not
#     based solely on profiling, or assessing personality traits or past
#     criminal behaviour of natural persons or groups.
# (e) Profiling of natural persons in the course of detection, investigation,
#     or prosecution of criminal offences.

law_enforcement_questions := [
	{
		"qid": "le_assess_victim_risk",
		"id": "annex_iii_6_a_victim_risk",
		"article": "Annex III(6)(a)",
		"summary": "Risk of a natural person becoming victim of a criminal offence.",
	},
	{
		"qid": "le_polygraph_or_similar",
		"id": "annex_iii_6_b_polygraph",
		"article": "Annex III(6)(b)",
		"summary": "Polygraph or similar tool used by law enforcement.",
	},
	{
		"qid": "le_evaluate_evidence_reliability",
		"id": "annex_iii_6_c_evidence_reliability",
		"article": "Annex III(6)(c)",
		"summary": "Evaluating reliability of evidence in criminal investigation.",
	},
	{
		"qid": "le_assess_offending_risk",
		"id": "annex_iii_6_d_offending_risk",
		"article": "Annex III(6)(d)",
		"summary": "Assessing risk of offending or re-offending or personality traits.",
	},
	{
		"qid": "le_profiling_in_criminal_proceedings",
		"id": "annex_iii_6_e_profiling",
		"article": "Annex III(6)(e)",
		"summary": "Profiling of natural persons during criminal investigation or prosecution.",
	},
]

annex_iii_categories contains reason if {
	some q in law_enforcement_questions
	answer_true(q.qid)
	reason := {
		"id": q.id,
		"article": q.article,
		"summary": q.summary,
	}
}
