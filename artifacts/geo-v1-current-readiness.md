# GEO V1 当前就绪状态（Codex 接手用）

更新时间：2026-05-26（Cursor P0 收口队列）

## 1. 当前 HEAD

- `02e281324a5423e484b5d4994e82449baabd26cc`（`chore: sync mac agent zip manifest after build copy`）
- 分支：`main`，已与 `origin/main` 同步

## 2. 最近关键提交

| Commit | 说明 |
|--------|------|
| `02e28132` | 同步 Mac zip 与 manifest `macZipSha256` |
| `cfb1cdd6` | Manus UI Sweep 后 P0 验收缺口收口 |
| `de871c9b` | Local Agent 账号环境左右布局 + manifest |
| `9976d5cd` | 平台内容策略面板浅色化、「生成该平台内容」文案 |
| `54a46fed` | 恢复 `accept:v1:sellable*` Harness 命令 |
| `3ea2b112` | 修复 `geo.articles.generate` 生成依据（generation basis） |
| `ad3576fb` / `2fc7ee52` | Local Agent 测试与启动窗口修复 |

## 3. Harness：`accept:v1:sellable*`

| 命令 | 状态 |
|------|------|
| `accept:v1:sellable` | 存在，编排 static + runtime |
| `accept:v1:sellable:static` | 存在；含 `check` / `build` / `test` + 静态验收脚本 |
| `accept:v1:sellable:runtime` | 存在；无 `DATABASE_URL` 时 **SKIP exit 0** |

脚本路径：

- `scripts/accept_v1_sellable_static.mjs`
- `scripts/accept_v1_sellable_runtime.mjs`

## 4. check / build / test（本机最近一次）

- `pnpm check`：通过
- `pnpm build`：通过（含 `postbuild` manifest 验收）
- `pnpm test`：通过（457 passed / 9 skipped）

## 5. Local Agent zip

- 路径：`client/public/downloads/geo-local-agent-mac.zip`
- 大小：约 103MB（非 4KB / 非 HTML）
- `macZipUrl`：`/downloads/geo-local-agent-mac.zip`
- `macDmgUrl`：`null`
- 最近一次 `macZipSha256`（**注意：`pnpm build` 的 `prebuild` 会重打包 zip，hash 会变**）：以 `client/public/downloads/manifest.json` 为准
- `unzip -t`：通过（`agent_mac_download_package_acceptance` 内含校验）
- `.app`：`GEO本地发布客户端.app`，`Contents/MacOS/GEO本地发布客户端` 为 arm64 可执行文件
- 窗口：`2fc7ee52` 主窗口启动修复在 `local-agent/src/main.ts`
- 账号环境 UI：`de871c9b` 起为左平台导航 + 右账号详情（`accounts-workspace`）

## 6. 平台内容生成

- 前端：`WeeklyContentPage` → `generateOne` → `trpc.geo.articles.generate`，payload 含 `topicId`、`targetPublishPlatform`、`contentStrategyType`、`targetQuestion`、`geoEnhancementGoal`、`targetAiPlatforms` 等
- 按钮文案：**「生成该平台内容」**（`PlatformContentBoard`）
- 错误：`readGenerateArticleError` → `toPlatformContentGenerationError`（客户化文案，非「生成遇到问题，已跳过」类工程句）
- 单测：`server/platformContentGeneration.test.ts`、`server/v12PlatformContentStrategy.test.ts` 通过
- **未在本轮做浏览器 真实点击 + DB 落库复测**（无 `DATABASE_URL` / 无联调 `pnpm dev`）

## 7. 旧 Chrome 插件

- Web 主链路：Local Agent（`pending_agent` / `publishMode: local_agent`）
- `content-growth-publish-extension/`：**不在仓库**；`agent_migration` 验收走 off-tree + `@legacy downloadExtension` 分支
- 客户页：无 Chrome 插件主入口文案（静态验收 + grep 抽检）

## 8. Manus UI Sweep 工程验收

- 已拉取：`cfb1cdd6`、`9976d5cd` 等
- `PlatformContentStrategyPanel`：已改浅色 token（`geoP0Surfaces`）
- **残留风险**：`ProfileIntakePanel`、`DashboardLayout` 未登录页等仍可能含 `ai-glass` / 暗色 class；`cfb1cdd6` 可能已部分处理，Codex 应再跑关键词 grep + `accept:v1:sellable:static`

## 9. 仍需真实环境验证

1. `DATABASE_URL` + LLM 环境下 `pnpm accept:v1:sellable:runtime`
2. `pnpm accept:p0:content-generation`（真实生成 + `geo_articles` 落库 + 刷新可见）
3. 浏览器 E2E：周内容页点击「生成该平台内容」全链路
4. Mac 本机安装 zip 后：窗口、账号左右布局、发布任务拉取
5. 每次 `pnpm build` 后确认 `manifest.json` 的 `macZipSha256` 与 zip 一致（或提交 sync commit）

## 10. Codex 最终验收应重点关注

1. **Harness 回归**：三条 `accept:v1:sellable*` 是否在 CI/干净 clone 上可跑通
2. **manifest / zip 一致性**：`prebuild` 复制后 hash 是否提交或自动化
3. **平台生成真实链路**：`3ea2b112` 修复是否在真实 DB 下不再 basis 报错
4. **Manus 浅色 Sweep 漏网**：`ProfileIntakePanel`、登录页暗色残留
5. **Local Agent 产物**：zip 完整性、签名/_gatekeeper、与 Web 下载卡片 URL 一致
