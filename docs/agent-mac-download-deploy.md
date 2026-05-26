# Mac 本地发布客户端 — 线上下载部署说明

## 为什么不能只靠 Git 部署带 zip

- `client/public/downloads/geo-local-agent-mac.zip` 约 **99MB**，在 `client/public/downloads/.gitignore` 中被排除（`*.zip` / `*.dmg` / `*.exe`）。
- Manus **从 Git 构建**时只会带上已入库的 `manifest.json`，**不会**带上未跟踪的大文件。
- 若仅部署相对路径 `macZipUrl: "/downloads/geo-local-agent-mac.zip"`，请求可能命中 **SPA fallback**，返回 `text/html`（约 3KB），**不是**真实安装包。

## 推荐方案：外部真实 zip URL

1. 在本机或 CI 打包：`cd local-agent && npm run package:mac`
2. 将 `geo-local-agent-mac.zip` 上传到 **对象存储 / CDN / Manus 静态制品**（可公开 HTTPS 下载）。
3. 构建或复制前设置环境变量：

```bash
export AGENT_MAC_ZIP_URL="https://<你的存储>/geo-local-agent-mac.zip"
node scripts/copy_local_agent_download.mjs
# 或
AGENT_MAC_ZIP_URL="https://..." pnpm build
```

4. 写入 `client/public/downloads/manifest.json`：

```json
{
  "macZipUrl": "https://<你的存储>/geo-local-agent-mac.zip",
  "macDmgUrl": null
}
```

5. 在 Manus **Deploy** 含上述 manifest 的构建（manifest 会随 Git 进入 `dist/public/downloads/`）。

本地开发未设置 `AGENT_MAC_ZIP_URL` 时，默认：

```json
{
  "macZipUrl": "/downloads/geo-local-agent-mac.zip",
  "macDmgUrl": null
}
```

需本机存在 `client/public/downloads/geo-local-agent-mac.zip`（`npm run package:mac` 后复制）。

## 构建命令示例

```bash
# 线上 Manus（大文件走外部 URL）
AGENT_MAC_ZIP_URL=https://cdn.example.com/geo-local-agent-mac.zip pnpm build
pnpm start

# 本地（相对路径 + 本地 zip 文件）
pnpm build
```

`prebuild` 会执行 `copy_local_agent_download.mjs`：有 `AGENT_MAC_ZIP_URL` 时仅更新 manifest；有 `local-agent/release` 时同时复制本地文件。

## 线上验收（必须通过才算真实可用）

```bash
AGENT_DOWNLOAD_BASE_URL=https://aigeoworkb-kzxhj9uy.manus.space \
  node scripts/agent_mac_online_download_acceptance.mjs
```

验收要求：

| 项 | 要求 |
|----|------|
| manifest | `macDmgUrl === null` |
| macZipUrl | 相对 `/downloads/geo-local-agent-mac.zip` **或** `https://` 绝对 URL |
| HTTP | 200 |
| Content-Type | **不能**包含 `text/html` |
| Content-Length | 存在且 **> 50MB** |
| 下载体积 | **> 50MB**；若仓库有对照 zip，须 **字节一致** |
| 完整性 | `unzip -t` 通过 |

若返回 HTML，说明 zip 未真实部署，需上传文件并配置 `AGENT_MAC_ZIP_URL` 后重新 Deploy。

## 禁止事项

- 不要把 99MB zip 强行提交 Git（除非明确评估 LFS/仓库限制且线上验收通过）。
- 不要恢复 `macDmgUrl` 非 null。
- 不要用 dev 隧道 `*.manus.computer` 冒充正式 `*.manus.space` 验收结论。
