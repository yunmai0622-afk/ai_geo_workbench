# Versioned Understand Governance

PR-03.6B adds immutable governance registries and formal Understand Assessments. It does not calculate Trust Score, Recommendation Gap or Growth Validation.

An Assessment binds project-scoped composite foreign keys for one Observation extraction and exact truth profile, question, extraction implementation, methodology and rule versions. `brand_truth_profile_versions` stores the immutable profile snapshot, while `brand_truth_profile_version_facts` identifies every concrete fact version in it. Dimension and rule results are child snapshots. The uniqueness key includes every governance version, so the same extraction can be assessed again under a different methodology without replacing history.

Automatic outcomes are immutable. Human confirmation, rejection and override are appended to `understanding_assessment_manual_reviews` with reviewer, time, reason and evidence snapshot. Reads derive the effective outcome from the latest review; they never update the automatic outcome.

`understanding_evaluations` remains unchanged. `VersionedUnderstandGovernanceService.listLegacyEvaluations` exposes those rows with an explicit legacy source and a null formal Assessment ID. It does not invent Observation provenance or version bindings.

All version and Observation links include `projectId`; TiDB rejects cross-project associations. The application service only creates immutable versions and append-only Assessments/review events, and exposes no update or delete operation for governed versions.
