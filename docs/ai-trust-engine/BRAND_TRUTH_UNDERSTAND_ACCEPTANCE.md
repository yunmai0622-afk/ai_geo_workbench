# PR-03.5 Brand Truth & Understand Acceptance

## 结论

**No-Go**。本分支完成了事实证据升级门槛、无伪严重度、方法论/coverage 快照和结构核验加固，但以下阻断项仍未通过，禁止合并、开启 210001 或部署：

1. Observation、answer、extraction 与 evaluation 仍共用 `understanding_evaluations`；raw answer 也仍存在普通 update 风险，尚无数据库不可变约束。
2. question version、methodology history、rule history 没有独立不可变对象；`understanding_rule_configs` 更新当前行。
3. 42 个事实定义没有 definition version、行业模板、required/optional/not_applicable、value type、cardinality 与 temporal semantics 持久化。
4. 0071 没有 FK；需要以生产等价数据库执行结构验证，不能仅凭代码宣布无 drift。
5. 未在本地伪造 210001 的公开证据或真实模型运行；2026-07-16 基线仍未形成，2026-07-23 仍只是未来复测节点。
6. 未执行生产 smoke、feature flag 开启、合并、部署。

## 已加固的 gate

- `shared/brandTruth.ts:canPromoteFactFromEvidence` 要求公开 URL、source owner、accessible、capturedAt、content hash、verified + approved。第三方必须 `independentSource=true`；multi-source 至少两个不同 source owner。
- `server/brandTruthRouter.ts:assertVerifiedStatusHasEvidence` 在 fact update 前执行上述规则；新事实不能直接创建为 verified。
- `deriveUnderstandingSeverity` 对 missing/unverifiable/accurate 返回 NULL；没有规则命中不再制造 P2。
- `0072_brand_truth_understand_acceptance_gate.sql` 将 severity 改为 nullable，并增加 evaluation 的 methodology、rule、权重和 coverage 快照字段；旧行保持 NULL，不伪回填。
- 新 evaluation 记录 `plannedQuestionCount,runQuestionCount,verifiedFactCount,extractionCoverage,assessmentCoverage,assessmentStatus`。

## 隔离审计

所有公开 router 先调用 `requireProjectAccess` 或 `requireScopedRow`；nested fact/evidence/evaluation/task 均以 `(id,projectId)` 查询，link 双侧均验证 project。service 汇总、运行、证据关联均以 projectId 过滤。当前没有 Brand Truth queue/consumer/export 实现，因此不能宣称这些未实现路径已通过；OEM 权限最终由 `server/projectAccess.ts` 集中判定。

## 页面与旧指标

`AIUnderstandingPage.tsx` 明示理解准确度不等于提及率、推荐率、信任分或资产总分；无完整八维结果时 total score 为 NULL。仓库仍需对 `/workspace,/ai-diagnosis,/monthly-plan,/weekly,/brand-source-graph,/delivery-reports` 做生产视觉回归，尤其确认旧 66/46 只位于 Legacy 区域。未完成该视觉证据前保持 No-Go。

## 210001

未写入或改写任何 07/12 历史数据，未将旧提及/推荐结果包装为 Understand。由于本任务环境没有经过人工确认的公开证据清单和可审计生产模型通道结果，已核验事实数、运行问题数、八维 coverage、偏差与严重度均不得编造，当前结论是“未形成正式 Understand baseline”。

## 上线/回滚

上线前执行 `pnpm db:verify-brand-truth -- --database-url <production-equivalent>`；先用 `pnpm db:export-brand-truth -- --project-id 210001 --out <dir>` 导出。0072 只增列并放宽 severity nullable；应用回滚可回到旧版本但保留新列。数据库回滚禁止 drop 数据列，采用停止 feature flag + 回滚应用；确认不再有新应用写入后再制定单独维护窗口 migration。
