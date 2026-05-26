# 构建产物说明（Artifacts）

本文档记录 **Local Agent 等二进制安装包** 的构建、分发与前后端协作规则。  
代码仓库只保留 `manifest.json`（HTTPS URL 与元数据）、验收脚本与下载入口逻辑；**安装包本体通过 GitHub Release / CDN 分发**。

---

## Local Agent 安装包规则（必读）

1. **`zip` / `dmg` / `pkg` 不进入 Git**（含 `client/public/downloads/*.zip`、`local-agent/release/` 等；遵守 `.gitignore`，不得为绕过规则取消忽略）。
2. **本地构建产物输出到 `local-agent/release/`**（`electron-builder` 默认 `directories.output`；示例：`GEO本地发布客户端-<version>-arm64-mac.zip`）。
3. **分发走 GitHub Release 或 CDN**（约 99MB，Manus 部署不会自动携带）；私有主仓 Release 需 **HTTPS 可匿名下载** 的 URL（常用公共镜像仓，见下文「当前线上配置」）。
4. **前端只读取 `client/public/downloads/manifest.json` 中的真实 HTTPS URL**（`macZipUrl` 为 `https://...`）；本地开发可用相对路径，**线上必须以公网 HTTPS 为准**。
5. **无真实 URL 时 Mac 下载按钮 `disabled`**，并提示「安装包暂未配置，请联系管理员上传 Local Agent 安装包」；禁止 mock 成功、禁止把 SPA/HTML 当 zip。
6. **禁止在 manifest / UI 暴露 `sourceDir`、本机绝对路径（如 `/Users/...`）、`token`、`cookie`、`file://`**。
7. **Cursor 负责**：`npm run package:mac` 构建、校验 size/sha256、上传 Release/CDN、更新 manifest 中的 `macZipUrl`、跑 `agent_mac_online_download_acceptance.mjs`。
8. **Manus 只负责**：前端下载入口展示与 Deploy；读取已提交的 manifest；**不在 sandbox 内打包或托管大体积 zip**。

---

## 1. Local Agent 安装包（macOS）

| 项 | 说明 |
|----|------|
| **对外文件名** | `geo-local-agent-mac.zip` |
| **生成方式** | `cd local-agent && npm run package:mac`（`electron-builder --mac dmg zip` + `scripts/copy_local_agent_download.mjs` 复制到 Web 目录） |
| **本地输出目录** | `local-agent/release/` |
| **builder 原始文件名示例** | `GEO本地发布客户端-1.0.0-arm64-mac.zip` |
| **Web 侧副本（不入 Git）** | `client/public/downloads/geo-local-agent-mac.zip` |
| **版本号** | `local-agent/package.json` → `version`（如 `1.0.0`） |
| **典型体积 / 校验** | 约 104,190,227 bytes；sha256 以本机构建实算为准（示例见下） |

### 当前线上配置（示例）

| 项 | 值 |
|----|-----|
| **公网 zip URL（manifest `macZipUrl`）** | `https://github.com/yunmai0622-afk/geo-local-agent-releases/releases/download/geo-local-agent-v1.0.0/geo-local-agent-mac.zip` |
| **公网 Release 页** | `https://github.com/yunmai0622-afk/geo-local-agent-releases/releases/tag/geo-local-agent-v1.0.0` |
| **私有主仓 Release（备份，匿名不可下）** | `https://github.com/yunmai0622-afk/ai_geo_workbench00/releases/tag/geo-local-agent-v1.0.0` |
| **示例 sha256** | `49eb4c748eed0413e161ddf443a7e3fcdee316407e9ff3aa58811030b58da0fb` — **示例值不可用于验收，正式发布必须以本机 `shasum -a 256` 实算结果为准。** |

> 私有仓库的 `browser_download_url` 对匿名用户常为 **404**；客户下载必须使用 **公共 Release 镜像仓** 或 OSS/CDN 直链。

### manifest.json 约定

**允许提交 Git 的字段示例**（勿含 `sourceDir`、`files` 中的本机路径）：

```json
{
  "version": "1.0.0",
  "copiedAt": "2026-05-26T08:45:30.000Z",
  "macZipUrl": "https://github.com/yunmai0622-afk/geo-local-agent-releases/releases/download/geo-local-agent-v1.0.0/geo-local-agent-mac.zip",
  "macDmgUrl": null,
  "winZipUrl": "/downloads/geo-local-agent-win.zip",
  "winSetupUrl": "/downloads/geo-local-agent-win.exe"
}
```

- **`macZipUrl`**：线上必须为 **HTTPS**；`null` 或未配置 → 前端禁用 Mac 下载。
- **`macDmgUrl`**：产品策略保持 **`null`**（不分发 dmg，除非另有公网 dmg URL）。
- 构建时可用 **`AGENT_MAC_ZIP_URL`** 写入 `macZipUrl`（见 `scripts/copy_local_agent_download.mjs`）。

### 校验命令

```bash
# 以 release 目录 canonical 包为准
shasum -a 256 "local-agent/release/GEO本地发布客户端-1.0.0-arm64-mac.zip"

# 线上验收（需正式域名，且 Manus 已 Deploy 最新 manifest）
AGENT_DOWNLOAD_BASE_URL=https://<正式域名> node scripts/agent_mac_online_download_acceptance.mjs
```

---

## 2. 禁止提交到 Git 的文件类型

| 类型 / 路径 | 说明 |
|-------------|------|
| `*.zip` / `*.dmg` / `*.pkg` | Local Agent 及扩展安装包 |
| `*.exe` | Windows 安装包 |
| `local-agent/release/` | electron-builder 全部输出 |
| `client/public/downloads/*.{zip,dmg,exe}` | Web 静态目录大文件副本 |
| `dist/public/downloads/*.{zip,dmg,exe}` | 构建输出中的安装包 |

**允许提交**：`client/public/downloads/manifest.json`（仅 URL 与元数据）、`ARTIFACTS.md`、验收脚本、前端下载组件。

---

## 3. Cursor / Manus 分工

| 角色 | 负责 | 不负责 |
|------|------|--------|
| **Cursor** | `package:mac` 构建；sha256/体积记录；上传 GitHub Release / CDN；更新 manifest `macZipUrl`；提交 manifest；跑线上验收脚本 | Manus 页面 UI 改版；在 Git 中提交 zip |
| **Manus** | Deploy；展示 `LocalAgentDownloadCard`；读取 manifest；无 URL 时禁用按钮与兜底文案 | 在 sandbox 打包 99MB zip；写入 `sourceDir`；伪造下载链接 |

---

## 4. 其他产物（简述）

| 产物 | 生成 | Git | 分发 |
|------|------|-----|------|
| `geo-local-agent-win.zip` / `.exe` | `npm run package:win` | 否 | 同 mac，Release/OSS |
| `manifest.json` | copy 脚本 / 手工维护 | **是** | 随应用 Deploy |
| `dist/public/downloads/*` 大文件 | `pnpm build` | 否 | 不依赖其作为线上 Mac 主链路 |

### 相关脚本与文档

- `scripts/copy_local_agent_download.mjs`
- `scripts/agent_mac_online_download_acceptance.mjs`
- `docs/agent-mac-download-deploy.md`
- `GEO_WORKFLOW.md` — 工作流索引（含本规则摘要）

---

## 5. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-26 | 初版：Local Agent mac zip、禁止类型、Manus/Cursor 分工 |
| 2026-05-26 | 增补「安装包规则」八条；公网 Release 镜像仓；manifest 禁止 sourceDir；线上 HTTPS 为主 |
