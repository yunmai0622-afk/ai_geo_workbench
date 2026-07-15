# AI Observation Immutability

`drizzle/0073_ai_observation_ledger.sql` is TiDB-compatible and contains no trigger DDL. Immutability has two layers:

1. Application code exposes INSERT-only Ledger operations. `server/aiObservationLedgerService.ts` contains no update/delete call for Run, Run Event, Answer, Extraction, Fact, Recommendation or Citation.
2. The future TiDB runtime principal must receive SELECT and INSERT only on the seven Ledger tables. Migration/admin credentials remain separate. Environment privilege verification is pending and the feature flag remains off.

Run identity is immutable. `createRun` inserts the Run plus its queued/running initial event in one transaction. Later status changes append `ai_observation_run_events`; `markRunTerminal` is only a compatibility wrapper around `appendRunEvent`. Current status is the last ordered event, and the full event history remains available.

Each parent exposes `UNIQUE(id,projectId)` and each child uses a composite foreign key containing its own `projectId`. This prevents cross-project Run Event, Answer, Extraction or structured-child linkage when FK capability is enabled and verified on the target TiDB version.

Schema verification uses `OBSERVATION_TEST_DATABASE_URL=... pnpm db:verify-ai-observation`. The production identity preflight uses the existing `DATABASE_URL` and executes only `SELECT VERSION(), @@version_comment`; it never prints the URL, host, database, account, or password. Without `DATABASE_URL` it reports `environment verification pending` and makes no connection.

Future privacy/legal deletion requires a separate authorized and audited administrative purge. It is not a normal application API and is not implemented here.
