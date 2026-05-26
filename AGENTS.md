# GEO 项目 — AI 工具协作约束

## 项目定位

企业 GEO 内容增长工作台（V1.0）：从企业建档、AI 诊断、内容生产、人工确认发布、收录监测到交付报告的最小可售卖闭环。主约束文档：**`HARNESS.md`**。

## 当前主链路（客户侧）

1. `/clients` 选项目  
2. `/workspace` 看阶段与下一步  
3. `/enterprise-profile` → `/ai-diagnosis` → `/weekly` → `/content-publishing` → `/inclusion-monitoring` → `/delivery-reports`

## 发布客户端（唯一方向）

- **Local Agent**（`local-agent/` + `pending_agent`）为唯一客户发布路径。  
- **禁止**恢复旧 Chrome 插件为客户主入口；`content-growth-publish-extension/` 仅 legacy 源码，不得出现在主 UI 文案或下载引导中。

## 路由收口（勿回退）

- `/demo`、`/demo/geo` → 重定向 `/clients`（禁止静态 Demo 数据作为主入口）。  
- `/flow` → 重定向 `/workspace`。  
- 不得删除 `DemoGeo.tsx` 等文件除非单独 Phase 批准；路由层已收口。

## 每次任务必做

1. `git pull --rebase`（冲突则停止并汇报）。  
2. 声明当前 **Phase**（见 `HARNESS.md`）。  
3. 完成后：`pnpm check`、`pnpm build`、`pnpm test`。  
4. 合并/发布前：`pnpm accept:v1:sellable:static`（有 DB 再跑 `pnpm accept:v1:sellable:runtime`）。  
5. 通过后 **commit + push**（由执行该任务的工具完成；禁止跳过 hook）。

## 反馈来源标识（回复标题必须带其一）

- `【CURSOR反馈】` — 工程、测试、真实链路、Local Agent、DB、接口、构建  
- `【MANUS反馈】` — UI、布局、客户体验、页面清晰度（勿改 Manus 进行中文件）  
- `【CODEX反馈】` — Harness、Playwright、验收报告、自动化闸门  
- `【MAINTENANCE反馈】` — 持续修复、清理、依赖  
- `【CAUSAL反馈】` — 策略分析、因果判断、产品验收建议  

## 工具分工

| 工具 | 负责 | 禁止 |
| --- | --- | --- |
| Cursor | 服务端、脚本、验收、Agent、DB 迁移、构建 | 擅自大改 Manus 负责的 UI 视觉 |
| Manus | 客户可读 UI、导航、文案 | 改 DB/权限/发布协议 |
| Codex | `accept:*`、Harness 文档、E2E 证据 | 无验收合并 |
| Maintenance | 缺陷修复、死代码、依赖 | 新功能 |
| Causal | 验收建议、优先级 | 直接改代码 |

## 禁止事项（P0）

1. 旧 Chrome 插件客户入口。  
2. mock / fake / 静态 demo 冒充真实项目数据。  
3. 向客户暴露工程字段（`taskId`、`rawAnswer`、`provider` 等）。  
4. 无边界扩展（P1/P2、多租户、支付、自动养号等，除非用户明确授权）。  
5. 新建与 `HARNESS.md` 并行的第二套 Harness。  
6. 跳过 `accept:v1:sellable:static` 或伪造验收通过。

## Phase / 优先级命名

- **Phase 1–10**：`HARNESS.md` 工程里程碑（不得擅自跨 Phase）。  
- **P0 / P1 / P2**：优化任务优先级字段，≠ Phase 编号。  
- **npm `accept:p0:*`**：数据库最小链路脚本；**`accept:v1:sellable`**：发布前总闸门。

## 完成后固定反馈格式

```
【<工具>反馈】
当前 Phase：
任务名称：
开始前同步：git status / pull / HEAD
本轮是否完成：
修改文件：
自测：check / build / test / accept:v1:sellable:static / runtime
风险 / 阻断：
提交：commit hash / push
下一步：（仅 P0）
```

详细客户路径与状态机对照见 **`HARNESS.md` 第十五、十六节**。
