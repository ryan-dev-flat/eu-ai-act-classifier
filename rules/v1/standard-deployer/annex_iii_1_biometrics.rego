package eu_ai_act.classification

import rego.v1

# Annex III(1) — Biometrics.
# (a) Remote biometric identification systems (excluding verification of identity).
# (b) Biometric categorisation according to sensitive or protected attributes.
# (c) Emotion recognition systems.
# Real-time remote biometric identification in publicly accessible spaces by
# law-enforcement is handled by the prohibited package (Article 5).

annex_iii_categories contains reason if {
	answer_true("performs_remote_biometric_identification")
	not answer_true("performs_only_biometric_verification")
	reason := {
		"id": "annex_iii_1_a_remote_biometric_id",
		"article": "Annex III(1)(a)",
		"summary": "Remote biometric identification system (excluding identity verification).",
	}
}

annex_iii_categories contains reason if {
	answer_true("performs_biometric_categorisation_sensitive_attributes")
	reason := {
		"id": "annex_iii_1_b_biometric_categorisation",
		"article": "Annex III(1)(b)",
		"summary": "Biometric categorisation by sensitive or protected attributes.",
	}
}

annex_iii_categories contains reason if {
	answer_true("performs_emotion_recognition")
	reason := {
		"id": "annex_iii_1_c_emotion_recognition",
		"article": "Annex III(1)(c)",
		"summary": "Emotion recognition system.",
	}
}
