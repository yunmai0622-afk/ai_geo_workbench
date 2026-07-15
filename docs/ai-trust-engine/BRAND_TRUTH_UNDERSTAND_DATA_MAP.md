# Brand Truth & Understand 实际数据地图

审计基线：`87a5a7e6dc09bc79002d2aeb5c9d452817e84b82`。本文件描述仓库实际实现，不把 adapter 包装成标准领域对象。

## 12 张现有表

定义均在 `drizzle/schema.ts:1437-1729`，首次建表 SQL 为 `drizzle/0071_brand_truth_understand_engine.sql`。

| 表 | 职责与关键字段 | 约束/索引 | 标准对象映射 |
|---|---|---|---|
| `brand_truth_profiles` | 项目事实基线；`projectId,currentVersion,status,completenessScore` | PK `id`；UQ `projectId` | `brand_truth_profiles`（正式） |
| `brand_truth_facts` | 当前事实投影；`profileId,projectId,factKey,factValue,verificationStatus,validFrom/To,*SourceCount,version` | PK；IDX `(projectId,factKey)`,`profileId` | `brand_truth_facts`（正式） |
| `brand_truth_fact_versions` | 事实值/状态变更历史；`factId,projectId,version,profileVersion,evidenceChange,changeReason` | PK；UQ `(factId,version)` | `brand_truth_versions`（adapter：不是完整 profile snapshot） |
| `brand_truth_evidence` | 公开证据；`url,sourceOwner,sourceClass,independentSource,accessible,capturedAt,evidenceHash,manualReviewStatus` | PK；IDX `projectId` | Evidence Ledger 前置对象（正式） |
| `brand_truth_fact_evidence_links` | 事实—证据显式关系；`projectId,factId,evidenceId,supportType,confidence` | PK；UQ `(factId,evidenceId)` | `brand_truth_evidence_links`（正式） |
| `brand_truth_conflicts` | 事实冲突与解决记录 | PK；IDX `(projectId,resolutionStatus)` | `brand_truth_conflicts`（正式） |
| `understanding_question_sets` | 项目问题集版本 | PK；UQ `(projectId,version)` | `ai_question_sets`（adapter） |
| `understanding_questions` | 问题当前行；`questionSetId,questionText,verificationFactKeys` | PK；IDX `questionSetId` | `ai_questions`；没有独立 `ai_question_versions`，由 question-set 版本间接承载（缺口） |
| `understanding_evaluations` | 当前把 observation、extraction、evaluation 合在一行；保存 raw answer 与快照字段 | PK UUID；IDX `(projectId,testedAt)` | `ai_observation_runs` + `ai_observation_answers` + `ai_extracted_brand_facts` + `understand_evaluations` 的兼容 adapter（阻断缺口） |
| `understanding_dimension_results` | evaluation 的八维结果与依据 | PK；UQ `(evaluationId,dimension)` | `understand_evaluations` 子结果（正式） |
| `understanding_correction_tasks` | Understand correction action；完成与复测状态 | PK；IDX `(projectId,status)` | correction actions（正式；未来 Action Engine 必须引用/迁移此 ID） |
| `understanding_rule_configs` | 项目规则配置当前版本 | PK；UQ `(projectId,ruleKey)` | rule config adapter；更新覆盖当前行，历史 rule body 未独立保存（缺口） |

数据库未声明 FK；隔离依赖每表 `projectId`、API `requireProjectAccess` 与复合 where。关键路径：`server/brandTruthRouter.ts`（API/repository）、`server/brandTruthService.ts`（创建基线、运行与汇总）、`shared/brandTruth.ts`、`shared/understandingEngine.ts`。没有独立 queue/job；真实运行在同步 mutation `runUnderstandingTest`。页面：`AIUnderstandingPage.tsx`、`BrandTruthOperationsPage.tsx`，并被 workspace/diagnosis/weekly/source graph/delivery report 引用。

## 事实定义与硬编码

42 个定义在 `shared/brandTruth.ts:BRAND_TRUTH_FACT_DEFINITIONS`；当前仅四个物理分类 `identity/business/capability_boundary/temporal`，其中 differentiation、applicability、limitation、relationship 通过 factKey 表达，尚未成为数据库一级分类。定义没有持久化 definition version、模板、value type、cardinality、temporal semantics；这是 No-Go 缺口。默认问题在 `shared/understandingEngine.ts:DEFAULT_UNDERSTANDING_QUESTION_TEMPLATES`。

8 维权重与版本配置在 `DEFAULT_UNDERSTANDING_METHODOLOGY`；新 evaluation 保存 `methodologyVersion,dimensionWeights,ruleVersion,truthProfileVersion,questionSetVersion,extractionVersion`。严重度规则仍为代码规则 `deriveUnderstandingSeverity`，稳定版本为 `understand-severity-v1`；P0/P1/P2 只在确定冲突类状态生成，无命中为 NULL。

## Legacy 与 correction 边界

`enterprise_geo_profiles` 只经 `buildUnverifiedTruthDrafts` 导入为 `provided_unverified`；`ai_test_runs` 仅能通过 project-scoped `linkExistingAiTestRun` 关联。旧 `geo_scores/geo_maturity_scores` 不参与 Understand 计算。

`understanding_correction_tasks` 是 Understand 专用 action，不是通用 trust action。它可与 monthly/weekly/content/publish task 在 UI 编排，但数据库无 FK。未来 Action Engine 应增加通用 action 主表并保留 `sourceType/sourceId=understanding_correction_task/<id>`，不得复制成无法追踪的平行任务。当前有 `factKey,observedStatement,expectedFact,actionType,dependency,completionCriteria,requiredEvidence,verificationQuestionIds,targetRetestRound`；缺少结构化 completion evidence，须后续增量补充。
