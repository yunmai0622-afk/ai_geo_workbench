# P1-A：客户项目管理台 — Cursor 增量改造指令

> **写在最前面的约束（Cursor 必须遵守）**
>
> - **禁止新建 Vue / Express / Prisma 项目**，本系统已有 React + tRPC + Drizzle + MySQL 技术栈
> - **禁止重建任何已有模块**，只做增量添加
> - 所有数据库操作通过 `drizzle/schema.ts` + Drizzle ORM 完成，禁止裸写 SQL
> - 所有 API 通过 tRPC router（`server/routers.ts`）添加，禁止新建 Express 路由文件
> - 所有新页面放在 `client/src/pages/`，注册到 `client/src/App.tsx`
> - 侧边栏新增菜单项只改 `client/src/components/DashboardLayout.tsx` 的 `navGroups` 数组
> - 使用已有 shadcn/ui 组件库（`client/src/components/ui/`），禁止引入新 UI 框架

---

## 背景说明

当前系统是单用户单项目视角：用户登录后只看到自己的项目，无法在一个界面俯瞰多个客户项目的整体进展。

P1-A 目标：在现有 `projects` 表基础上，新增一个**代理商客户管理台**页面（路由 `/clients`），让代理商能在一张表里看到所有客户项目的健康状态，并一键跳转进入任意客户的工作台。

**不需要改动数据库结构**（`projects` 表现有字段已足够支撑 P1-A），只需：
1. 在 tRPC 路由加一个聚合查询 procedure
2. 新建一个 React 页面
3. 在侧边栏加一个菜单入口

---

## STEP 1：在 tRPC router 新增 `clientDashboard` 聚合查询

**操作文件：`server/routers.ts`**

在 `geoRouter`（`const geoRouter = router({ ... })`）内，在 `projects: router({...})` 块**后面**添加一个新的 `clientDashboard` 路由块。

### 1-A 在文件顶部 import 区补充所需表

在现有 import 中已有 `geoArticles, geoPublishRecords, analysisResults, aiResponses, geoScores`——这些已经存在，不需要重复 import。确认以下表已在 import 列表中，若没有则补充：

```typescript
// 确认这几个已在 import { ... } from "../drizzle/schema" 中（通常已有）
// geoArticles, geoPublishRecords, analysisResults, aiResponses, geoScores
// 若没有，加入 import 列表即可
```

### 1-B 在 geoRouter 内添加 clientDashboard router 块

在 `geoRouter` 的 `publishRecords: router({...})` 块结尾的逗号后面，插入以下代码：

```typescript
clientDashboard: router({
  /**
   * 客户管理台聚合查询
   * 一次性返回所有项目的关键指标，供 /clients 页面渲染卡片列表
   */
  listProjectsSummary: protectedProcedure.query(async () => {
    const db = await requireDb();

    // 1. 拉取所有项目（按创建时间倒序）
    const allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));

    if (allProjects.length === 0) return [];

    const projectIds = allProjects.map((p) => p.id);

    // 2. 并行拉取各项目的汇总数
    const [articleRows, publishRows, aiResponseRows, analysisRows, scoreRows] =
      await Promise.all([
        // 内容资产数（已生成及以后状态的文章）
        db
          .select({ projectId: geoArticles.projectId })
          .from(geoArticles)
          .where(inArray(geoArticles.projectId, projectIds)),

        // 发布数（有发布记录的文章）
        db
          .select({ projectId: geoPublishRecords.projectId })
          .from(geoPublishRecords)
          .where(inArray(geoPublishRecords.projectId, projectIds)),

        // AI 实测数（aiResponses 条数）
        db
          .select({ projectId: aiResponses.projectId })
          .from(aiResponses)
          .where(inArray(aiResponses.projectId, projectIds)),

        // 最近诊断时间（analysisResults 最新 createdAt）
        db
          .select({
            projectId: analysisResults.projectId,
            createdAt: analysisResults.createdAt,
          })
          .from(analysisResults)
          .where(inArray(analysisResults.projectId, projectIds))
          .orderBy(desc(analysisResults.createdAt)),

        // GEO 评分（geoScores 最新记录）
        db
          .select({
            projectId: geoScores.projectId,
            score: geoScores.score,
            createdAt: geoScores.createdAt,
          })
          .from(geoScores)
          .where(inArray(geoScores.projectId, projectIds))
          .orderBy(desc(geoScores.createdAt)),
      ]);

    // 3. 按 projectId 做 Map 聚合
    const articleCountMap = new Map<number, number>();
    for (const r of articleRows) {
      articleCountMap.set(r.projectId, (articleCountMap.get(r.projectId) ?? 0) + 1);
    }

    const publishCountMap = new Map<number, number>();
    for (const r of publishRows) {
      publishCountMap.set(r.projectId, (publishCountMap.get(r.projectId) ?? 0) + 1);
    }

    const aiTestCountMap = new Map<number, number>();
    for (const r of aiResponseRows) {
      aiTestCountMap.set(r.projectId, (aiTestCountMap.get(r.projectId) ?? 0) + 1);
    }

    // 最近诊断时间：每个项目取第一条（已按 desc 排序）
    const lastDiagnosisMap = new Map<number, Date>();
    for (const r of analysisRows) {
      if (!lastDiagnosisMap.has(r.projectId)) {
        lastDiagnosisMap.set(r.projectId, r.createdAt);
      }
    }

    // 最新 GEO 分：每个项目取第一条（已按 desc 排序）
    const latestScoreMap = new Map<number, number>();
    for (const r of scoreRows) {
      if (!latestScoreMap.has(r.projectId)) {
        latestScoreMap.set(r.projectId, r.score ?? 0);
      }
    }

    // 4. 组装返回结果
    return allProjects.map((p) => ({
      id: p.id,
      enterpriseName: p.enterpriseName,
      industry: p.industry,
      website: p.website,
      region: p.region,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      articleCount: articleCountMap.get(p.id) ?? 0,
      publishCount: publishCountMap.get(p.id) ?? 0,
      aiTestCount: aiTestCountMap.get(p.id) ?? 0,
      lastDiagnosisAt: lastDiagnosisMap.get(p.id) ?? null,
      latestGeoScore: latestScoreMap.get(p.id) ?? null,
    }));
  }),
}),
```

> **注意**：`inArray` 已在文件顶部 import from `"drizzle-orm"`，`desc` 也已存在，无需重新 import。

---

## STEP 2：新建客户管理台页面

**新建文件：`client/src/pages/ClientDashboardPage.tsx`**

完整文件内容如下，直接创建：

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Brain,
  Building2,
  Clock,
  FileText,
  Loader2,
  Search,
  Send,
  TrendingUp,
  Users2,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

// 项目状态映射：status enum → 中文标签 + 颜色
const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  created: { label: "已创建", variant: "outline" },
  questions_ready: { label: "问题库就绪", variant: "secondary" },
  responses_imported: { label: "AI实测中", variant: "secondary" },
  analysis_done: { label: "诊断完成", variant: "default" },
  score_done: { label: "评分完成", variant: "default" },
  tasks_ready: { label: "任务规划中", variant: "default" },
  report_ready: { label: "报告就绪", variant: "default" },
};

// 格式化距今时间
function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return "尚未诊断";
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  return `${Math.floor(diffDays / 30)} 个月前`;
}

// GEO 评分颜色
function getScoreColor(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

type ProjectSummary = {
  id: number;
  enterpriseName: string;
  industry: string;
  website: string;
  region: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  articleCount: number;
  publishCount: number;
  aiTestCount: number;
  lastDiagnosisAt: Date | null;
  latestGeoScore: number | null;
};

function ProjectCard({
  project,
  onEnter,
}: {
  project: ProjectSummary;
  onEnter: (id: number) => void;
}) {
  const statusInfo = STATUS_MAP[project.status] ?? { label: project.status, variant: "outline" as const };

  return (
    <Card className="group border border-white/10 bg-white/[0.03] transition-all hover:border-cyan-400/20 hover:bg-white/[0.05]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-semibold text-slate-100">
              {project.enterpriseName}
            </CardTitle>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {project.industry} · {project.region}
            </p>
          </div>
          <Badge variant={statusInfo.variant} className="shrink-0 text-xs">
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 核心指标：4 个数字 */}
        <div className="grid grid-cols-4 gap-2">
          {/* GEO 评分 */}
          <div className="flex flex-col items-center rounded-lg bg-white/[0.04] px-2 py-2.5 text-center">
            <TrendingUp className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <span className={`text-lg font-bold leading-none ${getScoreColor(project.latestGeoScore)}`}>
              {project.latestGeoScore ?? "—"}
            </span>
            <span className="mt-1 text-[10px] text-slate-500">GEO分</span>
          </div>

          {/* 内容资产数 */}
          <div className="flex flex-col items-center rounded-lg bg-white/[0.04] px-2 py-2.5 text-center">
            <FileText className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <span className="text-lg font-bold leading-none text-slate-200">
              {project.articleCount}
            </span>
            <span className="mt-1 text-[10px] text-slate-500">内容资产</span>
          </div>

          {/* 发布数 */}
          <div className="flex flex-col items-center rounded-lg bg-white/[0.04] px-2 py-2.5 text-center">
            <Send className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <span className="text-lg font-bold leading-none text-slate-200">
              {project.publishCount}
            </span>
            <span className="mt-1 text-[10px] text-slate-500">已发布</span>
          </div>

          {/* AI 实测数 */}
          <div className="flex flex-col items-center rounded-lg bg-white/[0.04] px-2 py-2.5 text-center">
            <Brain className="mb-1 h-3.5 w-3.5 text-slate-500" />
            <span className="text-lg font-bold leading-none text-slate-200">
              {project.aiTestCount}
            </span>
            <span className="mt-1 text-[10px] text-slate-500">AI实测</span>
          </div>
        </div>

        {/* 最近诊断时间 */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          <span>最近诊断：{formatRelativeTime(project.lastDiagnosisAt)}</span>
        </div>

        {/* 进入工作台按钮 */}
        <Button
          size="sm"
          variant="outline"
          className="w-full border-cyan-400/20 text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-400/10"
          onClick={() => onEnter(project.id)}
        >
          进入工作台
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ClientDashboardPage() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const { data: projects = [], isLoading } = trpc.geo.clientDashboard.listProjectsSummary.useQuery();

  // 按企业名称 / 行业过滤
  const filtered = projects.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.enterpriseName.toLowerCase().includes(q) ||
      p.industry.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q)
    );
  });

  // 一键进入客户工作台：切换 activeProjectId 并跳首页
  // 当前系统用 projects[0] 作为当前项目，代理商切换客户时暂用 URL 参数方案——
  // P1-A 阶段先跳到首页（用户自行在企业档案切换），P1-B 再做 activeProjectId 全局 context。
  const handleEnter = (_projectId: number) => {
    // TODO P1-B：通过全局 context 或 URL 搜索参数传入 projectId，
    //            让系统加载该客户项目数据而非 projects[0]
    setLocation("/");
  };

  // 汇总统计卡
  const totalArticles = projects.reduce((s, p) => s + p.articleCount, 0);
  const totalPublished = projects.reduce((s, p) => s + p.publishCount, 0);
  const totalAiTests = projects.reduce((s, p) => s + p.aiTestCount, 0);
  const avgScore =
    projects.length > 0
      ? Math.round(
          projects
            .filter((p) => p.latestGeoScore !== null)
            .reduce((s, p) => s + (p.latestGeoScore ?? 0), 0) /
            Math.max(1, projects.filter((p) => p.latestGeoScore !== null).length),
        )
      : null;

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">客户项目管理台</h1>
        <p className="text-sm text-slate-400">统览所有客户的 GEO 增长进展，一键进入工作台</p>
      </div>

      {/* 全局汇总条 */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={<Users2 className="h-4 w-4" />} label="客户总数" value={projects.length} unit="个" />
          <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="平均 GEO 分" value={avgScore ?? "—"} unit={avgScore !== null ? "分" : ""} />
          <SummaryCard icon={<FileText className="h-4 w-4" />} label="内容资产总量" value={totalArticles} unit="篇" />
          <SummaryCard icon={<Send className="h-4 w-4" />} label="累计发布" value={totalPublished} unit="次" />
        </div>
      )}

      {/* 搜索栏 */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="搜索客户名称、行业、地区…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-slate-500">
          <Building2 className="h-10 w-10 opacity-30" />
          <p className="text-sm">{search ? "没有匹配的客户项目" : "暂无客户项目，请先创建"}</p>
          {!search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/enterprise-profile")}
              className="mt-2"
            >
              创建第一个客户
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} onEnter={handleEnter} />
          ))}
        </div>
      )}
    </div>
  );
}

// 小汇总卡片组件
function SummaryCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-xl font-bold leading-tight text-slate-100">
          {value}
          {unit && <span className="ml-0.5 text-xs font-normal text-slate-500">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
```

---

## STEP 3：注册路由和侧边栏菜单

### 3-A 在 App.tsx 注册路由

**操作文件：`client/src/App.tsx`**

**第一步：** 在 import 区（其他页面 import 下方）补充：

```typescript
import ClientDashboardPage from "./pages/ClientDashboardPage";
```

**第二步：** 在 `PrivateRoutes` 函数的 `<Switch>` 内，找到 `<Route path="/" component={Home} />` 这一行，在它**前面**插入：

```tsx
<Route path="/clients" component={ClientDashboardPage} />
```

### 3-B 在 DashboardLayout.tsx 添加侧边栏菜单项

**操作文件：`client/src/components/DashboardLayout.tsx`**

**第一步：** 在 lucide-react import 中补充 `Users2`：

```typescript
import { BarChart3, Brain, Building2, FileBarChart2, FileText, LineChart, LogOut, PanelLeft, Send, Sparkles, Users2 } from "lucide-react";
```

**第二步：** 找到 `navGroups` 数组，在**最前面**新增一个分组（在 `"增长总览"` 分组**之前**插入）：

```typescript
const navGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: "代理商",
    items: [
      {
        icon: Users2,
        label: "客户管理台",
        desc: "所有客户项目总览",
        path: "/clients",
        aliases: ["/clients"],
      },
    ],
  },
  // ... 后面保持原有的 "增长总览"、"内容资产" 等分组不变
```

---

## STEP 4：类型安全检查（Cursor 执行后验证）

执行完以上三步后，在项目根目录运行：

```bash
npx tsc --noEmit
```

如果出现类型报错，按以下原则修复：

1. **`inArray` 参数类型报错**：确认 `projectIds` 是 `number[]` 类型，`geoArticles.projectId` 是 `int` 列
2. **`geoScores.score` 类型报错**：查看 `drizzle/schema.ts` 中 `geoScores` 表的 `score` 字段类型，按实际类型调整
3. **trpc 路由类型报错**：确认 `clientDashboard` 在 `geoRouter` 内且正确被 `appRouter` export

---

## STEP 5：联调验证清单

完成代码变更后，在浏览器中依次验证：

| 验证项 | 预期结果 |
|--------|----------|
| 访问 `/clients` | 正常渲染客户管理台页面，不报错 |
| 侧边栏顶部 | 出现「代理商」分组，包含「客户管理台」菜单项 |
| 多项目场景 | 每个项目卡片显示正确的文章数、发布数、AI实测数 |
| 无项目时 | 显示空状态 + 「创建第一个客户」按钮 |
| 搜索过滤 | 输入企业名称、行业、地区可实时过滤卡片 |
| GEO 分颜色 | ≥70 绿色，40-69 黄色，<40 红色，无分数显示「—」 |
| 「进入工作台」按钮 | 点击跳转到 `/`（P1-B 阶段再实现 projectId 切换） |

---

## 后续 P1-B 扩展说明（本次不做，仅供参考）

P1-A 完成后，"进入工作台"按钮跳到 `/` 但系统还是加载 `projects[0]`，不会真正切换到被点击的客户。P1-B 需要：

1. 在 `App.tsx` 或 React Context 中增加 `activeProjectId` 全局状态
2. 所有 tRPC 查询从 `projects[0].id` 改为读取 `activeProjectId`
3. 「进入工作台」按钮改为 `setActiveProjectId(id); setLocation("/")`

这是一个较大的重构，单独作为 P1-B 任务规划，不在本次 Cursor 指令范围内。

---

## 文件变更总览

| 文件 | 操作 | 改动位置 |
|------|------|---------|
| `server/routers.ts` | 增量添加 | `geoRouter` 内，`publishRecords` 块之后新增 `clientDashboard` router |
| `client/src/pages/ClientDashboardPage.tsx` | 新建 | 全新文件 |
| `client/src/App.tsx` | 增量添加 | import + Route `/clients` |
| `client/src/components/DashboardLayout.tsx` | 增量添加 | lucide import + navGroups 顶部新增分组 |

**不涉及任何数据库 migration**，`projects`、`geoArticles`、`geoPublishRecords`、`aiResponses`、`geoScores` 表结构无需改动。
