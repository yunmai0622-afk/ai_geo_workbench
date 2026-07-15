# AI Observation Database Compatibility Decision

Status: **Code Ready / Environment Verification Pending**. Production engine is confirmed by the owner as TiDB Cloud; exact version and runtime grants remain unverified.

## Authoritative target identity

| Evidence source | Observed result | What it proves |
|---|---|---|
| `drizzle.config.ts` and Drizzle metadata | dialect `mysql` | SQL generation family only; it does not distinguish MySQL from TiDB. |
| `server/db.ts` | `drizzle-orm/mysql2` | Driver/protocol compatibility only. |
| `docs/production-deploy.md` and `docs/railway-production-deploy.md` | says “MySQL through DATABASE_URL” | Repository intent, but no managed service type or exact server version. |
| `railway.json` | application service config only | No database plugin/service identity. |
| Railway CLI | not installed/linked; status unavailable | No authoritative Railway service inventory was obtained. |
| Local `.env` URL, sanitized | `mysql://127.0.0.1:3306/ai_geo_workbench` | This is a local non-production endpoint and cannot identify production. |
| Local read-only identity query | `VERSION() = 9.6.0`, `@@version_comment = Homebrew` | Local test engine is MySQL 9.6.0 Homebrew only. |
| Local `CURRENT_USER()` / `SHOW GRANTS` | `root@localhost`, global administrative grants with grant option | Local account is not an acceptable runtime-user model. |

Production engine/provider are TiDB Cloud by owner confirmation. Exact version, production-equivalent test version and production runtime grants remain unknown. No production connection was made.

## Capability decision

The revised `0073_ai_observation_ledger.sql` contains no trigger DDL. It defines seven append-only tables, including `ai_observation_run_events`, plus composite foreign keys and enum/json DDL.

- MySQL supports triggers, foreign keys and table/column privileges, but support alone is insufficient: 0073 must be executed against the same production major/minor family using separate migration and runtime users.
- TiDB is not interchangeable with MySQL for DDL capability. Trigger and foreign-key behavior is version-dependent and must be proven for the exact target. If production is TiDB and its target version does not support any 0073 DDL, 0073 must be revised before it can be applied; a later migration cannot repair a failure that prevents 0073 from completing.
- The local MySQL 9.6 result cannot substitute for TiDB or for another MySQL production version.

Official references to use once the target is known:

- MySQL trigger syntax: <https://dev.mysql.com/doc/refman/8.4/en/create-trigger.html>
- MySQL privilege grants: <https://dev.mysql.com/doc/refman/8.4/en/grant.html>
- TiDB MySQL compatibility: <https://docs.pingcap.com/tidb/stable/mysql-compatibility/>
- TiDB foreign keys: <https://docs.pingcap.com/tidb/stable/foreign-key/>

## Immutability scheme decision

The selected TiDB scheme is append-only tables plus an INSERT/SELECT-only runtime principal. Run state is represented by `ai_observation_run_events`; no Ledger application path updates or deletes rows. Composite FK support must still be proven on the exact target version and may not be silently removed.

In both cases the migration/admin principal must be distinct from the runtime principal. The application must use only the runtime URL; migration credentials must be supplied only to a dedicated migration job. The current repository exposes only `DATABASE_URL`; this separation is not yet implemented or verified.

## 0073 compatibility inventory

Provisionally compatible only after exact-version testing:

- Seven append-only Ledger tables, including `ai_observation_run_events`.
- Explicit columns, unique keys and indexes.
- Composite `(parentId, projectId)` foreign keys, subject to exact target support.
- JSON, enum, timestamp and mediumtext types, subject to exact target semantics.

Unapproved/unknown:

- Foreign-key enforcement and error behavior.
- Runtime table/column privilege enforcement.
- Migration marker behavior after DDL failure.
- Fresh, 0072-upgrade and malformed-schema migration paths.

## Minimum non-sensitive operations evidence required

Operations must provide only the following; no passwords or full connection strings are needed:

1. Railway database service/plugin type and managed provider name.
2. Output of `SELECT VERSION();` and `SELECT @@version_comment;` from production or a production-equivalent clone.
3. Production-equivalent test image/service version.
4. Sanitized application URL identity: protocol plus provider/host class, with username/password removed.
5. `SHOW GRANTS FOR CURRENT_USER()` from the application runtime connection, with usernames/hosts optionally redacted consistently.
6. `SHOW GRANTS` for the migration principal, similarly redacted.
7. Confirmation that application runtime and migration jobs use different principals and different secret variables.
8. For TiDB, exact FK/trigger capability for that deployed version and any compatibility configuration affecting enforcement.

After those facts are supplied, implementation can resume with `ai_observation_run_events`, target-specific 0073 revision, disposable production-equivalent database setup, real migration paths and direct runtime-user immutability tests.
