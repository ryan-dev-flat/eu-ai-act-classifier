package eu_ai_act.classification

import rego.v1

# Annex III(2) — Critical infrastructure.
# AI systems intended to be used as safety components in the management and
# operation of critical digital infrastructure, road traffic, or in the supply
# of water, gas, heating or electricity.

critical_infrastructure_domains := [
	"road_traffic",
	"water_supply",
	"gas_supply",
	"heating_supply",
	"electricity_supply",
	"critical_digital_infrastructure",
]

annex_iii_categories contains reason if {
	answer_true("is_safety_component_of_critical_infrastructure")
	answer_in("critical_infrastructure_domain", critical_infrastructure_domains)
	reason := {
		"id": "annex_iii_2_critical_infrastructure",
		"article": "Annex III(2)",
		"summary": "Safety component in the management or operation of critical infrastructure.",
	}
}
