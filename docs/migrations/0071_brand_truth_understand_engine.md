# 0071 Brand Truth / Understand Engine 迁移说明

## 写入范围

迁移只创建 12 张 V3.2 专用表及索引，不修改、回填或删除现有项目、发布、知乎 URL、AI 复测、OEM、Local Agent 数据。旧企业档案不会在迁移中写入事实表，也不会自动标记为 verified。

## 锁表与上线风险

- 仅执行 `CREATE TABLE` / `CREATE INDEX`，不对现有业务表执行 `ALTER TABLE`。
- 不扫描或更新历史数据，预期不会形成现有大表的长事务锁。
- 如果任一建表语句失败，部署必须停止；应用代码不得先于迁移对新表写入。
- 生产导入由运营通过项目级 API 显式触发，导入项统一为 `provided_unverified`。

## 回滚方案

应用代码回滚后，新表可以保留，不影响旧版本运行。若经备份确认必须物理回滚，应按依赖逆序在维护窗口删除：

1. `understanding_dimension_results`
2. `understanding_correction_tasks`
3. `understanding_evaluations`
4. `understanding_rule_configs`
5. `understanding_questions`
6. `understanding_question_sets`
7. `brand_truth_conflicts`
8. `brand_truth_fact_evidence_links`
9. `brand_truth_fact_versions`
10. `brand_truth_evidence`
11. `brand_truth_facts`
12. `brand_truth_profiles`

物理删除会丢失 V3.2 的事实版本、证据关联和理解评价，因此默认采用“回滚应用、保留新表”的安全方案。执行任何 `DROP TABLE` 前必须先备份并确认没有新版本写入。
