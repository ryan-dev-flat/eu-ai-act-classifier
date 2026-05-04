package eu_ai_act.classification

import rego.v1

# Aggregate high-risk classification per Article 6(2) (Annex III categories)
# and Article 6(1) (Annex I safety components). Per-category fact patterns
# live in annex_iii_*.rego and annex_i_safety_component.rego — those files
# contribute objects to `annex_iii_categories`. This file collapses that set
# into the boolean `high_risk_match` consumed by shared/main.rego, and
# enforces the Article 6(3) derogation.

# Set of triggered reasons surviving the Article 6(3) derogation. Each entry
# is {"id": ..., "article": ..., "summary": ...}.
triggered_high_risk_reasons contains reason if {
	some reason in annex_iii_categories
	not article_6_3_exempt
}

# An Annex III system that would otherwise be high-risk but qualifies for the
# Article 6(3) derogation is recorded separately so reviewers see both the
# original match and the documented exemption rationale.
suppressed_high_risk_reasons contains reason if {
	some reason in annex_iii_categories
	article_6_3_exempt
}

high_risk_match if {
	count(triggered_high_risk_reasons) > 0
}
