# AI Observation Immutability

Migration `drizzle/0073_ai_observation_ledger.sql` installs MySQL `BEFORE UPDATE` and `BEFORE DELETE` triggers on:

- `ai_observation_answers`
- `ai_observation_extractions`
- `ai_extracted_brand_facts`
- `ai_recommendation_results`
- `ai_citation_results`

These reject changes with SQLSTATE `45000`. Therefore raw answer, raw provider metadata, provider response ID, content hash, extraction payload and structured children cannot be overwritten through another SQL client or an accidentally permissive application route.

Run rows are mutable only through `markRunTerminal`, which changes status/completion/error fields and scopes by `(id,projectId)` plus a queued/running precondition. Run identity fields are never updated by the service.

Every parent exposes `UNIQUE(id,projectId)` and every child uses a composite foreign key containing its own `projectId`. This prevents an answer from referencing another project's run, an extraction from referencing another project's answer, or a child result from referencing another project's extraction.

Schema verification: `OBSERVATION_TEST_DATABASE_URL=... pnpm db:verify-ai-observation`. Destructive integration testing is deliberately restricted to a dedicated test schema and additionally requires `ALLOW_OBSERVATION_LEDGER_TEST_DB=true pnpm test:db:ai-observation`.

Future privacy/legal deletion must be an explicit administrative purge with authorization, audit record and ordered ledger deletion. That path is not a normal business API and is not implemented in this PR.
