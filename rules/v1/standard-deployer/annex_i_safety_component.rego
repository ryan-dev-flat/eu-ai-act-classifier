package eu_ai_act.classification

import rego.v1

# Article 6(1) — An AI system is high-risk where both of the following are met:
# (a) the AI system is intended to be used as a safety component of a product,
#     or is itself a product, covered by Union harmonisation legislation
#     listed in Annex I; AND
# (b) that product (or the AI system as a product) is required to undergo a
#     third-party conformity assessment under that legislation.
#
# Annex I (Section A and Section B) covers, e.g., machinery, toys, lifts,
# medical devices, in-vitro diagnostics, civil aviation security, motor
# vehicles, marine equipment, and rail systems.

annex_i_legislation := [
	"machinery_directive_2006_42_or_reg_2023_1230",
	"toy_safety_directive_2009_48",
	"recreational_craft_directive_2013_53",
	"lifts_directive_2014_33",
	"atex_directive_2014_34",
	"radio_equipment_directive_2014_53",
	"pressure_equipment_directive_2014_68",
	"cableway_installations_reg_2016_424",
	"ppe_reg_2016_425",
	"gas_appliances_reg_2016_426",
	"medical_devices_reg_2017_745",
	"in_vitro_diagnostics_reg_2017_746",
	"civil_aviation_reg_2018_1139",
	"motor_vehicles_reg_2018_858",
	"marine_equipment_directive_2014_90",
	"rail_interoperability_directive_2016_797",
	"agricultural_forestry_vehicles_reg_167_2013",
	"two_or_three_wheel_vehicles_reg_168_2013",
]

annex_i_match if {
	answer_true("is_safety_component_under_annex_i")
	answer_in("annex_i_legislation", annex_i_legislation)
	answer_true("requires_third_party_conformity_assessment")
}

# Surface the Annex I match in the same triggered-categories collection so
# the rationale renderer treats it uniformly.
annex_iii_categories contains reason if {
	annex_i_match
	reason := {
		"id": "article_6_1_annex_i_safety_component",
		"article": "Article 6(1) + Annex I",
		"summary": "Safety component of a product subject to Annex I harmonisation legislation requiring third-party conformity assessment.",
	}
}
