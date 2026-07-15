# Legacy Understanding Boundary

`understanding_evaluations` is now defined as a **legacy mixed evaluation record**. PR-03.6A does not rename, delete, backfill or migrate it.

Legacy reads continue through the existing Brand Truth/Understand service. The new ledger service imports none of the legacy tables and never dual-writes raw answers into `understanding_evaluations`. The `ai_observation_ledger_v2` flag defaults off, so existing production behavior remains unchanged.

PR-03.6B may create new assessment and manual-review objects referencing an immutable extraction. Multiple methodology versions may assess the same extraction without changing the answer or extraction.

PR-03.6C must migrate legacy data explicitly. It must preserve provenance, distinguish unavailable metadata from real zero/false values, and never claim an old mixed row has provider metadata that was not originally captured. Migration should write a mapping table or audit manifest connecting each legacy evaluation ID to any created run/answer/extraction IDs. Until that reviewed migration exists, legacy and v2 reads remain visibly separate.

AI output is an observation of model behavior, not Brand Truth. Extracted values cannot enter `brand_truth_facts` without the separate public-evidence verification workflow.
