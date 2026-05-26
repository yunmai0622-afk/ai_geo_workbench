# GEO 工作流说明

本文件描述跨环境协作要点；**二进制安装包细则以 [`ARTIFACTS.md`](./ARTIFACTS.md) 为准**。

---

## Local Agent 安装包（Cursor ↔ Manus）

| # | 规则 |
|---|------|
| 1 | `zip` / `dmg` / `pkg` **不进入 Git** |
| 2 | 本地构建输出目录：**`local-agent/release/`** |
| 3 | 客户下载分发：**GitHub Release / CDN**（非 Git、非 Manus sandbox 内打包） |
| 4 | 前端仅使用 **`manifest.json` 中的真实 HTTPS `macZipUrl`** |
| 5 | **无真实 URL** → Mac 下载按钮 **disabled** + 管理员提示文案 |
| 6 | 禁止暴露 **`sourceDir`、本地路径、`token`、`cookie`** |
| 7 | **Cursor**：构建、上传产物、更新 manifest、验收 |
| 8 | **Manus**：Deploy + 下载入口 UI，不构建/不托管大 zip |

### 推荐操作顺序（Cursor）

1. `cd local-agent && npm run package:mac`
2. 在 `local-agent/release/` 核对 zip 体积与 `shasum -a 256`
3. 上传到 **公网可匿名下载** 的 Release / CDN（见 `ARTIFACTS.md` 当前 URL 示例）
4. 更新 `client/public/downloads/manifest.json` 的 `macZipUrl`（HTTPS），**不写 `sourceDir`**
5. `pnpm check` → `pnpm build` → `AGENT_DOWNLOAD_BASE_URL=<正式域名> node scripts/agent_mac_online_download_acceptance.mjs`
6. 仅提交 manifest（及本文档类变更），`git push`；通知 **Manus 重新 Deploy**

### Manus 侧

- 拉取含最新 `manifest.json` 的 `main` 并 Deploy。
- 不修改下载兜底逻辑（无 URL 禁用、不展示本机路径）。
- 部署后验证：`/downloads/manifest.json` 中 `macZipUrl` 为 HTTPS，Mac 按钮可下载且非 HTML/404。

---

## 其他工作流

业务 Phase、前端清理、工程安全验收等见仓库 `artifacts/` 下各 Phase 报告与 `scripts/*_acceptance.mjs`。
