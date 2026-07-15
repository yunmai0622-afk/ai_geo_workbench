# Versioned Understand Governance

PR-03.6B adds immutable governance registries and formal Understand Assessments. It does not calculate Trust Score, Recommendation Gap or Growth Validation.

An Assessment binds one extraction identity to an exact truth profile version, question version, extraction implementation version, methodology version and primary rule version. Dimension and rule results are child snapshots. The uniqueness key includes every governance version, so the same extraction can be assessed again under a different methodology without replacing history.

Automatic outcomes are immutable. Human confirmation, rejection and override are appended to `understanding_assessment_manual_reviews` with reviewer, time, reason and evidence snapshot. Reads derive the effective outcome from the latest review; they never update the automatic outcome.

`understanding_evaluations` remains unchanged. `VersionedUnderstandGovernanceService.listLegacyEvaluations` exposes those rows with an explicit legacy source and a null formal Assessment ID. It does not invent Observation provenance or version bindings.

This branch starts from `main`, where PR-03.6A is not yet merged. Observation and Extraction IDs are therefore stored as immutable external identities without a database foreign key. After PR-03.6A lands, integration must add project-scoped composite foreign keys in a reviewed forward-only migration before production rollout.
