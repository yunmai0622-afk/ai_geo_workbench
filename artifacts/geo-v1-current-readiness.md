# GEO V1 当前可验收状态（P0 夜间队列后）

> 生成时间：2026-05-26（本地 Asia/Shanghai）  
> 用途：供 Codex 最终验收读取，避免重复改代码与无限循环。

## 1. 当前 HEAD

- **Commit**：`225e8fcb`（字段映射修复基线；本报告编写时工作区另有未推送的 Phase 2–4 补丁，推送后以 `git log -1` 为准）
- **分支**：`main`

## 2. 最近关键提交

| 主题 | Commit | 说明 |
|------|--------|------|
| 企业建档 ↔ 平台生成字段映射 | `225e8fcb` | `shared/platformContentProfileReadiness.ts`、upsert 同步 projects、具体缺项文案 |
| Local Agent 窗口 / 验收恢复 | `ad3576fb` | DownloadCard、测试对齐（历史） |
| 平台生成错误映射 | `3ea2b112` | 客户化 tRPC 错误、诊断 vs 资料不足区分 |
| Harness 脚本恢复 | `54a46fed` | `accept:v1:sellable:*` |
| UI Final Polish P0 | `84a2f5d7` | Manus 浅色主路径、Local Agent 账号左右布局 |

**本轮夜间新增（推送后）**：

- 平台化正文 `test-template` 补齐 `## 平台适配说明` / `## GEO 质量自检说明`（否则 `geo.articles.generate` 在平台策略下结构校验失败）
- `scripts/geo_platform_content_generation_real_retest.ts`（DATABASE_URL + `GEO_ARTICLE_BODY=test-template` 真实落库复测）
- `manifest.json` macZipSha256 与 103MB zip 对齐

## 3. P0 已通过项

- [x] 海豚知道 8 项建档字段 → `evaluateEnterpriseProfileReadiness` 不再误报笼统「资料不足」
- [x] `pnpm check` / `pnpm build` / `pnpm test`（464 passed）
- [x] `pnpm accept:v1:sellable:static`
- [x] `node scripts/agent_mac_download_package_acceptance.mjs`
- [x] `pnpm accept:v1:sellable`（**shell 未 export DATABASE_URL** 时 runtime 自动 SKIP exit 0）
- [x] Local Agent mac zip：~103MB、可解压、含 `.app`、Mach-O arm64、`manifest.macZipSha256` 与文件一致
- [x] 平台生成 API 复测：`geo.articles.generate` 落库（脚本，见 §9）

## 4. P0 阻断 / 待补环境

| 项 | 状态 | 说明 |
|----|------|------|
| `accept:v1:sellable:runtime`（带 DATABASE_URL） | **未通过** | `p0_real_chain_acceptance` 需真实 LLM：`AI 诊断结果数量不是 10`（无 OPENAI/Forge 配置时） |
| 浏览器 E2E 点击「生成该平台内容」 | **未执行** | 夜间队列以 tRPC + DB 脚本代替；需 `pnpm dev` + 登录态 + Playwright |
| Chrome 插件客户入口 | 已关闭 | 迁移验收 skip（扩展目录可不在树内） |

## 5. accept:v1:sellable 命令状态

| 命令 | 结果 |
|------|------|
| `pnpm accept:v1:sellable:static` | **通过** |
| `pnpm accept:v1:sellable:runtime` | **SKIP**（shell 无 `DATABASE_URL`）/ **失败**（`.env` 有 DB 但无 LLM） |
| `pnpm accept:v1:sellable` | **通过**（runtime SKIP 时） |

## 6. 工程自检

| 命令 | 结果 |
|------|------|
| `pnpm check` | 通过 |
| `pnpm build` | 通过（postbuild manifest 验收通过） |
| `pnpm test` | 464 passed, 9 skipped |

## 7. Local Agent zip

- 路径：`client/public/downloads/geo-local-agent-mac.zip`
- 大小：约 **103MB**
- SHA256（与 `manifest.json` 一致时）：见 `client/public/downloads/manifest.json` → `macZipSha256`
- 解压：含 `GEO本地发布客户端.app`，`Contents/MacOS` 可执行 arm64

## 8. Local Agent 窗口与账号布局

- 账号环境：`local-agent/src/renderer/index.html` → `.accounts-layout`（左右布局）
- 样式：`local-agent/src/renderer/style.css`（含小红书/公众号相关布局）

## 9. 平台内容生成

| 检查项 | 结果 |
|--------|------|
| 建档 → upsertProfile → projects 同步 | 通过（脚本断言 `productIntro` 含「知识主播」） |
| 生成前 readiness | 通过 |
| `geo.articles.generate` | 通过（articleId 落库，`GEO_ARTICLE_BODY=test-template`） |
| payload | `projectId` / `zhihu` / `contentStrategyType` / `targetQuestion` / `platformStrategy` |
| 真实浏览器点击 | **未执行** |

复测命令：

```bash
pnpm exec tsx scripts/geo_platform_content_generation_real_retest.ts
```

## 10. 企业资料字段映射（Phase 1）

| 页面字段 | 保存（enterprise_geo_profiles / projects） | 生成读取 |
|----------|-------------------------------------------|----------|
| 企业名称 | `enterpriseName` / `brandName` → projects.`enterpriseName` | `brandName` + projects |
| 所属行业 | `industry` / `industryTag` | `industry` |
| 一句话介绍 | `oneLiner` | `companyIntro` 候选 |
| 核心产品/服务 | `productDesc` / `productServiceIntro` | `productService` 候选 |
| 目标客户 | `targetCustomer` / `targetCustomers` | `targetCustomer` |
| 主要解决的问题 | `customerPains[]` | 辅助上下文 |
| 核心优势 | `keyPoints` / `coreSellingPoints` | `oneLiner` / 卖点 |
| 关键词 | `keywords[]` | 生成 basis / 片段 |
| targetQuestion | 平台策略 `platformStrategy.targetQuestion` | `basis.customerQuestion`（enrich） |

缺项文案：`企业资料还缺少：xxx、xxx。请先完善后再生成。`

## 11. UI 主路径

- 客户工作台 Manus 浅色：`/workspace` 等（见 `84a2f5d7`）
- 旧 Chrome 插件下载入口：已移除主路径（验收脚本覆盖）

## 12. 工程字段主视觉

- 企业建档 / 平台内容：客户文案为主；内部字段名不直接暴露给终端用户（生成正文 prompt 亦要求不暴露）

## 13. 暗色残留

- 主路径：P0 抛光队列已清 slate/cyan/violet（`84a2f5d7`）
- 非主路径：可能存在历史页残留 → **P1**

## 14. runtime 为何 SKIP / 失败

- **SKIP**：执行 `pnpm accept:v1:sellable` 的 shell **未 export** `DATABASE_URL`（脚本设计 exit 0）。
- **失败**：`source .env` 后有 `DATABASE_URL`，但 `p0_real_chain_acceptance` 需要 **OpenAI 或 Forge**（`OPENAI_API_KEY` + `OPENAI_BASE_URL` + `OPENAI_MODEL` 或 `BUILT_IN_FORGE_*`）。

## 15. 有 DATABASE_URL 后补跑

```bash
set -a && source .env && set +a
pnpm accept:v1:sellable:runtime
pnpm exec tsx scripts/geo_platform_content_generation_real_retest.ts
# 可选浏览器：
# pnpm dev
# C1F_BASE_URL=http://localhost:3000 node scripts/c1f_browser_delivery_acceptance.mjs
```

## 16. Codex 最终验收只允许

1. `git pull --rebase`
2. 阅读本文档
3. `pnpm accept:v1:sellable:static`
4. 若环境齐全：`pnpm accept:v1:sellable:runtime`
5. Playwright / 页面验收（可选）
6. 输出 `artifacts/geo-v1-acceptance-report.md`
7. **禁止**在无新 P0 缺陷时无限循环改代码

## 17. P1 可延期（勿卡 P0）

- 全量 runtime LLM 诊断 10 条自动验收
- 浏览器全链路 E2E
- 非主路径暗色 UI 清理
- Manus 视觉精修

## 18. 需要 Manus

- 无新增 P0 UI 阻断（本轮未改 Manus 页面）

## 19. 需要 Codex

- 配置 LLM 后跑 runtime + 生成 `geo-v1-acceptance-report.md`
- 老板人工验收清单见下（产品侧）

---

**老板明天最短人工验收（3 条）**

1. 企业建档填齐 8 项 → 平台化内容资产 → 知乎 →「生成该平台内容」：不应再出现笼统「企业资料不足」；若缺项应列出具体字段名。
2. 下载 `client/public/downloads/geo-local-agent-mac.zip`（约 103MB）→ 解压打开 → 账号页为左右布局。
3. `pnpm accept:v1:sellable:static` 通过（Codex/CI 可代跑）。
