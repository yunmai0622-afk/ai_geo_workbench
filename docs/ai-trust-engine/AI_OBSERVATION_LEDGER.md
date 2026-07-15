# AI Observation Ledger

PR-03.6A freezes four independent boundaries:

1. Question Definition describes what was planned. Answers persist `questionKey`, version, text and scenario snapshots so later question edits cannot change history.
2. Observation Run identifies one provider/model/configuration execution. Re-running the same question set always creates another `ai_observation_runs.id`.
3. Observation Answer is the provider response for one attempt. `ai_observation_answers` is append-only; retry uses a new ID and incremented `attemptNumber`.
4. Extraction is one extractor attempt over one answer. `ai_observation_extractions` and its fact/recommendation/citation rows are append-only. Another version or retry creates another extraction.

Assessment and manual review are intentionally not implemented here. They are derived, recalculable PR-03.6B objects. An extracted statement is neither Brand Truth nor proof that the statement is correct.

## Storage

- `ai_observation_runs`: provider, model/version/channel, purpose, prompt version/hash/snapshot, sampling, application version, status and errors.
- `ai_observation_answers`: immutable raw answer/metadata, content hash, question snapshots, provider response ID, nullable latency/token data and citation capability.
- `ai_observation_extractions`: extractor/prompt/model versions, status, payload, coverage/confidence and citation extraction status.
- `ai_extracted_brand_facts`: structured extracted facts with uncertainty; no path promotes these into `brand_truth_facts`.
- `ai_recommendation_results`: mention, candidate and recommendation are separate enums; rank remains NULL without explicit ordering.
- `ai_citation_results`: citation state distinguishes unsupported, unknown, extraction_failed, detected and not_detected.

Provider failure is retained as a failed run or `provider_error` answer. It must not create a successful empty answer or fabricated extraction. Missing provider response ID, latency and token counts remain NULL.

Writes go only through `server/aiObservationLedgerService.ts` and are guarded by the default-off `ai_observation_ledger_v2` flag (`AI_OBSERVATION_LEDGER_V2=true` only in an explicitly enabled environment).
