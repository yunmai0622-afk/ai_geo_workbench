# GEO 本地发布客户端

代运营团队在本地执行的发布助手：从 GEO Web 拉取 `pending_agent` 发布任务，使用**独立浏览器 Profile**（Playwright `launchPersistentContext`）登录各平台并填入标题/正文，向 GEO 服务端**真实回传**任务状态（不 mock 成功）。

**版本**：1.0.0

---

## 能力边界（当前真实状态）

| 能力 | 工程层 | 本机实机（知乎） |
|------|--------|------------------|
| Electron 桌面窗口（5 Tab） | 已通过 | 需本机 `npm run dev` 确认 |
| 本地 HTTP `127.0.0.1:39888` | 已通过 | 随客户端启动 |
| 知乎账号检测 | 代码已增强 | **需登录后人工验证** |
| 登录态复用 / 写作页 | 代码已增强 | **未通过**（见 `artifacts/phase2-session-reuse-report.json`） |
| 知乎自动填稿 + 状态回传 | 代码就绪 | **未执行**（Phase 3 闸门：Phase 2 未通过） |
| Web 绑定 + `pending_agent` 闭环 | 代码就绪 | **未验证**（无已绑定知乎账号） |
| 搜狐 / 百家号 / 头条 | 代码存在 | **未做真实试运行** |

---

## 安全说明（必读）

1. **不保存平台密码** — 客户端与服务端均不存储、不上传账号密码。
2. **Cookie 不上传** — Cookie 仅存在于本机 `profiles/{profileId}/` Chromium 数据目录，不会上传到 GEO 服务器。
3. **登录态保存在本机 profile** — 删除 profile 或清空该目录后需重新登录。
4. **服务端仅存** `localAgentId`、`localProfileId` 等元数据，**不存** `profilePath`。
5. **任务状态不伪造**：无明确草稿保存证据不得 `draft_saved`；无 `publicUrl` 不得 `completed`。

---

## 安装 Mac 客户端（推荐，无需 Node）

GEO Web **企业档案 → 平台账号绑定** 顶部可下载：

- `geo-local-agent-mac.dmg`（推荐）
- `geo-local-agent-mac.zip`（备用）

### 1. 安装

1. 双击 `.dmg`，将 **GEO本地发布客户端** 拖入「应用程序」。
2. 首次打开若提示「无法验证开发者」：系统设置 → 隐私与安全性 → **仍要打开**（或右键 App → 打开）。
3. 若 Gatekeeper 拦截：可对 App 执行 `xattr -cr "/Applications/GEO本地发布客户端.app"` 后重试（仅本机信任时使用）。

### 2. 启动与确认 39888

1. 从启动台或应用程序文件夹打开客户端。
2. 菜单栏/窗口出现 **GEO 本地发布客户端**。
3. 浏览器或终端验证：`curl http://127.0.0.1:39888/health` 应返回 `{"ok":true,"agentId":...}`。
4. GEO Web 点击 **检测客户端**，应显示已连接。

### 3. 绑定知乎账号

1. 打开客户端 **账号环境** → **+ 知乎**（或在 Web 绑定流程中自动创建 profile）。
2. **打开登录** → 在弹出 Chromium 窗口登录知乎。
3. **检测账号** → 卡片主区域显示**账号昵称**、登录状态、最近检测/发布；`profileId` 仅在「查看技术信息」中展示。
4. 回到 Web 企业档案完成「绑定发布账号」。

### 4. 卸载

1. 退出客户端（菜单退出或关闭窗口）。
2. 删除 `/Applications/GEO本地发布客户端.app`。
3. 可选删除本机数据（将清除登录态）：`local-agent` 目录下的 `data/`、`profiles/`（开发目录）或安装版在用户目录下的等价数据路径（见客户端设置说明）。

### 5. 安全说明

- **不保存平台密码**，`accounts.json` 无 password 字段。
- **不上传 Cookie**；Cookie 仅在本机 Chromium Profile 目录。
- Web 仅保存 `localAgentId`、`localProfileId` 等元数据。

---

## 开发者：从源码运行

## 安装依赖

```bash
cd local-agent
npm install
```

- 国内网络：仓库内 `.npmrc` 已配置 Electron 镜像（`npmmirror`）。
- 验证 Electron：`node scripts/ensure-electron.mjs`
- Playwright Chromium（打开知乎等登录页必需）：

```bash
npx playwright install chromium
```

---

## 打包 Mac / Windows 安装包

```bash
cd local-agent
npm run package:mac    # 产物：release/*.dmg、release/*-mac.zip，并复制到 Web client/public/downloads/
npm run package:win    # 需在 Windows 或 CI 上验证；Mac 上可生成 zip/nsis 但需在真机测试
```

---

## 启动客户端（开发）

```bash
cd local-agent
npm run dev
```

成功标志：

1. 终端：`[local-agent] HTTP http://127.0.0.1:39888`
2. 弹出窗口，标题 **「GEO 本地发布客户端」**（约 1200×800）
3. 可见 Tab：**总览 / 账号环境 / 发布任务 / 执行日志 / 设置**

快速重启界面（已 build 过）：`npm run dev:electron`

**不要**仅用 `node -e "require('./dist/agent/localServer').startLocalAgentServer()"` — 只有 HTTP，**没有桌面窗口**。

GEO Web（另一终端）：

```bash
cd .. && pnpm dev
```

在 **设置** 填写 `serverUrl`（如 `http://127.0.0.1:3000`），**总览 → 测试连接**。

---

## 知乎账号环境：创建 → 登录 → 检测

### 1. 创建知乎 profile

**账号环境** Tab → **+ 知乎**。  
或在 GEO Web 企业档案「绑定发布账号」时由 HTTP 创建（需客户端已启动）。

本机记录写入 `data/accounts.json`（含 `profileId`、`profilePath`，**无 password 字段**）。

### 2. 打开登录

点击该 profile **「打开登录」** → 弹出 **Playwright Chromium** 窗口（非系统默认浏览器）→ 在窗口内**手动登录**知乎。

**不要**在检测前关闭该窗口（检测会复用同一 `profilePath` 的 context）。

### 3. 检测账号

点击 **「检测账号」**。终端应出现：

```text
[agent-zhihu] detect start { profileId, url }
[agent-zhihu] candidate { source, selector, text }
```

成功时账号卡显示：**真实昵称 +「登录有效」**；`accounts.json` 中 `sessionStatus: active`。

失败时显示**具体原因**（非仅「失败」），例如：

- 登录态未生效，请重新打开登录窗口…
- 未检测到昵称，请确认知乎窗口已登录
- 未找到知乎头像/昵称元素

冒烟（可选）：

```bash
REALRUN_LOGIN_WAIT_SEC=120 node scripts/zhihu_detect_smoke.mjs
```

---

## 打开写作页

账号环境 → **「发布页」**，或验收：

```bash
node scripts/session_reuse_smoke.mjs
```

- 目标 URL：`https://zhuanlan.zhihu.com/write`
- **成功**：URL 为写作页且检测到**标题/正文编辑器** → `sessionStatus` 可为 `active`
- **失败类型**：`session_expired` / `login_required` / `write_page_not_found`（仅有 `/write` URL 但无编辑器时**不会**判成功）

---

## 填稿与任务状态

### 客户端自动处理（Web 任务）

1. Web **内容资产** 选择已绑定且 `sessionStatus=active` 的知乎账号 → 创建任务 → 状态 **`pending_agent`**
2. 客户端 **总览** → **开始轮询** 或 **立即拉取任务**
3. Agent：`pollTasks` → `claimTask` → 打开写作页 → 填标题/正文 → `reportTaskResult`

### 状态含义（真实规则）

| 状态 | 含义 |
|------|------|
| `manual_required` | 已填标题/正文，但**无明确草稿保存证据**，需人工在浏览器窗口确认保存 |
| `draft_saved` | **有明确保存成功证据**（如保存按钮反馈、草稿 URL 变化等） |
| `session_expired` | 登录失效 |
| `failed` | 如 `title_input_not_found`、`content_input_not_found`、`editor_not_found`、`account_mismatch` |
| `completed` | **必须**有 `publicUrl`（本轮知乎试运行不要求正式发布） |

本地日志：`data/logs/task-{taskId}.json`（逐步 step，非 mock）。

### 本地填稿验收（需 Phase 2 已通过）

```bash
node ../scripts/agent_realrun_zhihu_fill_acceptance.mjs
```

---

## 常见问题

### Electron 启动失败

- 报错 `Electron failed to install correctly`：删除 `node_modules/electron` 后 `npm install`（见 `.npmrc` 镜像）。
- 无窗口：必须用 `npm run dev`，不能只用 node 启 HTTP。
- 闪退：先 `npm run build`，查看终端完整堆栈。

### Playwright 浏览器缺失

```bash
npx playwright install chromium
```

### 端口 39888 被占用

```bash
lsof -i :39888
# 结束旧 node / Electron 进程后重新 npm run dev
```

总览会红色提示端口占用。

### 知乎检测不到昵称

1. 确认在 **Playwright 弹窗**内已登录，不是未登录 signin 页。
2. 登录后先 **检测账号**，勿先关窗口。
3. 看终端 `[agent-zhihu] candidate` 是否为空；若 DOM 改版需更新 `platforms/zhihuPublisher.ts`（仅 selector，禁止 mock 昵称）。
4. 勿把登录页文案（如「适老化」「开通机构号」）当成昵称（已做过滤，若仍异常请提 issue）。

### 登录态失效

- 检测/发布页跳转 signin → **重新登录**（「打开登录」或「重新登录」）。
- 勿同时用两个进程抢同一 `profilePath`（只保留一个 `npm run dev`）。

### 写作页打不开 / 找不到编辑器

- `write_page_not_found`：未加载编辑器，可能未登录或知乎改版。
- 在弹窗中手动打开写作页对比；导出 **诊断包** 给研发。

### Mac 打包应用无法打开

未签名：系统设置 → 隐私与安全性 → 仍要打开；或右键 → 打开。

---

## 打包

```bash
npm run build
npm run package:mac   # release/*.dmg
npm run package:win   # 建议在 Windows 上执行
```

安装包不含 Playwright 二进制；目标机需自行 `npx playwright install chromium`。

---

## 数据目录

| 路径 | 说明 |
|------|------|
| `data/config.json` | serverUrl、轮询 |
| `data/agent.json` | localAgentId |
| `data/accounts.json` | 账号元数据（无 password） |
| `data/logs/task-*.json` | 任务执行日志 |
| `profiles/` | 浏览器 Profile（含 Cookie，勿上传） |

**设置 → 导出诊断包**：脱敏配置与日志摘要，不含 Cookie / profile 目录明文。

---

## 开发 / 验收命令

```bash
npm run typecheck
npm run build
npm test
npm run smoke:zhihu-detect      # 知乎检测
npm run smoke:session-reuse     # 登录态 + 写作页
```

```bash
curl http://127.0.0.1:39888/health
node scripts/agent_final_static_acceptance.mjs   # 仓库根目录
```

交付与实机报告见仓库 `artifacts/AGENT_REALRUN_REPORT.md`、`artifacts/AGENT_SERIES_SCREENSHOTS.md`。
