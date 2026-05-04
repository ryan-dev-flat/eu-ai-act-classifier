package eu_ai_act.classification

import rego.v1

# Annex III(7) — Migration, asylum and border control management (in so far as
# their use is permitted under applicable Union or national law).
# (a) Polygraphs and similar tools.
# (b) Assessing risks (security, irregular migration, health) posed by a
#     natural person who intends to enter, or has entered, a Member State.
# (c) Examining applications for asylum, visa and residence permits and
#     associated complaints with respect to eligibility, including
#     assessments of the reliability of evidence.
# (d) Detecting, recognising or identifying natural persons in the context of
#     migration, asylum and border control (excluding verification of travel
#     documents).

migration_questions := [
	{
		"qid": "mig_polygraph_or_similar",
		"id": "annex_iii_7_a_polygraph",
		"article": "Annex III(7)(a)",
		"summary": "Polygraph or similar tool in migration, asylum, or border control.",
	},
	{
		"qid": "mig_risk_assessment_of_persons",
		"id": "annex_iii_7_b_risk_assessment",
		"article": "Annex III(7)(b)",
		"summary": "Security / irregular-migration / health risk assessment of natural persons.",
	},
	{
		"qid": "mig_examine_asylum_visa_applications",
		"id": "annex_iii_7_c_application_review",
		"article": "Annex III(7)(c)",
		"summary": "Examining asylum, visa, or residence permit applications and complaints.",
	},
	{
		"qid": "mig_detect_or_identify_persons",
		"id": "annex_iii_7_d_identification",
		"article": "Annex III(7)(d)",
		"summary": "Detecting or identifying persons in migration / border-control contexts.",
	},
]

annex_iii_categories contains reason if {
	some q in migration_questions
	answer_true(q.qid)
	reason := {
		"id": q.id,
		"article": q.article,
		"summary": q.summary,
	}
}
