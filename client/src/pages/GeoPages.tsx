import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { GeoStatusGuide, pageGuides } from "@/components/GeoStatusGuide";
import { useLocation } from "wouter";

const questionTypes = ["品牌认知", "行业推荐", "竞品对比", "痛点解决", "价格选型", "高意向成交", "指定问题"] as const;
const questionSourceLabels: Record<string, string> = { ai_generated: "AI 生成", manual: "手动指定", csv: "CSV 导入" };
const platforms = ["ChatGPT", "DeepSeek", "豆包", "Kimi", "通义", "文心", "Perplexity", "其他"] as const;
const taskStatuses = ["todo", "doing", "done", "retest"] as const;
const taskStatusLabels: Record<(typeof taskStatuses)[number], string> = { todo: "待处理", doing: "进行中", done: "已完成", retest: "待复测" };
const projectStatusLabels: Record<string, string> = {
  created: "已创建项目",
  questions_ready: "已生成问题库",
  responses_imported: "已导入 AI 回答",
  analysis_done: "已完成 AI 分析",
  score_done: "已生成 GEO 评分",
  tasks_ready: "已生成优化任务",
  report_ready: "已生成模板和报告",
};
const projectNextSteps: Record<string, { completedStep: string; nextAction: string; buttonText: string; targetPath: string }> = {
  created: { completedStep: "项目基础信息已创建", nextAction: "生成 AI 问题库", buttonText: "生成问题库", targetPath: "/questions" },
  questions_ready: { completedStep: "AI 问题库已准备", nextAction: "导入 AI 回答", buttonText: "去导入回答", targetPath: "/responses" },
  responses_imported: { completedStep: "AI 回答已导入", nextAction: "运行 AI 语义分析", buttonText: "开始分析", targetPath: "/analysis" },
  analysis_done: { completedStep: "AI 语义分析已完成", nextAction: "生成 GEO 评分", buttonText: "计算评分", targetPath: "/scores" },
  score_done: { completedStep: "GEO 评分已生成", nextAction: "生成优化任务", buttonText: "生成任务", targetPath: "/tasks" },
  tasks_ready: { completedStep: "优化任务已生成", nextAction: "生成内容模板和报告", buttonText: "生成模板和报告", targetPath: "/reports" },
  report_ready: { completedStep: "模板和报告已生成", nextAction: "生成 GEO 文章选题并进入质检审核", buttonText: "进入文章发布", targetPath: "/articles" },
};

type ProjectStepHint = { completedStep: string; nextAction: string; buttonText: string; targetPath: string };
type ProjectFormState = {
  enterpriseName: string;
  industry: string;
  website: string;
  region: string;
  productIntro: string;
  targetCustomers: string;
  coreSellingPoints: string;
  competitorNamesText: string;
  coreKeywordsText: string;
};

const emptyProjectForm: ProjectFormState = {
  enterpriseName: "",
  industry: "",
  website: "",
  region: "",
  productIntro: "",
  targetCustomers: "",
  coreSellingPoints: "",
  competitorNamesText: "",
  coreKeywordsText: "",
};

const splitList = (value: string) => value.split(/[，,\n]/).map(item => item.trim()).filter(Boolean);
const joinList = (value: string[] | null | undefined) => (value ?? []).join("，");
const nowLocalValue = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const materialToHtml = (title: string, content: string) => `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>${escapeHtml(title)}</title>\n</head>\n<body>\n<article>\n${escapeHtml(content).split("\n").map(line => line.trim() ? `<p>${line}</p>` : "").join("\n")}\n</article>\n</body>\n</html>`;

function PageHeader({ title, description }: { title: string; description: string }) {
  const guide = pageGuides[title];
  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-100 shadow-[0_0_34px_rgba(56,189,248,0.10)] backdrop-blur">
        <p className="text-sm font-medium text-cyan-200">企业 AI GEO 增长工作台</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
      </div>
      {guide ? <GeoStatusGuide {...guide} /> : null}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-white/10 bg-slate-950/70 p-5 text-slate-100 shadow-[0_0_28px_rgba(15,23,42,0.40)] backdrop-blur ${className}`}>{children}</section>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-400/5 p-6 text-center">
      <p className="font-medium text-slate-100">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function Button({ children, type = "button", onClick, disabled, variant = "primary" }: { children: React.ReactNode; type?: "button" | "submit"; onClick?: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "danger" }) {
  const styles = variant === "primary" ? "bg-blue-700 text-white hover:bg-blue-800" : variant === "danger" ? "bg-red-600 text-white hover:bg-red-700" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}>
      {children}
    </button>
  );
}

function Input({ label, value, onChange, placeholder = "", type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder = "", rows = 4 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
        {children}
      </select>
    </label>
  );
}

function useSelectedProject() {
  const projectsQuery = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(() => {
    const stored = window.localStorage.getItem("geo-selected-project-id");
    const parsed = stored ? Number(stored) : undefined;
    return parsed && Number.isFinite(parsed) ? parsed : undefined;
  });

  useEffect(() => {
    const list = projectsQuery.data ?? [];
    if (list.length === 0) return;
    const exists = selectedProjectId ? list.some(project => project.id === selectedProjectId) : false;
    if (!exists) {
      setSelectedProjectId(list[0].id);
      window.localStorage.setItem("geo-selected-project-id", String(list[0].id));
    }
  }, [projectsQuery.data, selectedProjectId]);

  const setProjectId = (id: number | undefined) => {
    setSelectedProjectId(id);
    if (id) window.localStorage.setItem("geo-selected-project-id", String(id));
  };

  const selectedProject = (projectsQuery.data ?? []).find(project => project.id === selectedProjectId);
  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  return { projects: projectsQuery.data ?? [], selectedProject, selectedProjectId, setProjectId, projectInput, isLoading: projectsQuery.isLoading };
}

function ProjectProgressCard({ project, articleHint }: { project?: { status: string | null }; articleHint?: ProjectStepHint }) {
  if (!project) return null;
  const status = project.status ?? "created";
  const next = articleHint ?? projectNextSteps[status] ?? projectNextSteps.created;
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
        <div><p className="text-xs text-slate-500">当前状态</p><p className="mt-1 font-semibold text-slate-950">{projectStatusLabels[status] ?? "已创建项目"}</p></div>
        <div><p className="text-xs text-slate-500">当前已完成步骤</p><p className="mt-1 text-sm text-slate-700">{next.completedStep}</p></div>
        <div><p className="text-xs text-slate-500">下一步建议动作</p><p className="mt-1 text-sm text-slate-700">{next.nextAction}</p></div>
        <Button onClick={() => { window.location.href = next.targetPath; }}>{next.buttonText}</Button>
      </div>
    </div>
  );
}

function resolveArticleStepHint(tasks: Array<{ id: number; status?: string | null }>, topics: Array<{ id: number }>, articles: Array<{ id: number; status: string | null }>, records: Array<{ id: number }>): ProjectStepHint | undefined {
  const hasTasks = tasks.length > 0;
  const hasTopics = topics.length > 0;
  const hasArticles = articles.length > 0;
  if (hasTasks && !hasTopics) return { completedStep: "优化任务已生成", nextAction: "有优化任务但无文章选题：生成 GEO 文章选题", buttonText: "生成文章选题", targetPath: "/articles" };
  if (hasTopics && !hasArticles) return { completedStep: "GEO 文章选题已生成", nextAction: "有选题但无文章：生成 GEO 文章", buttonText: "生成 GEO 文章", targetPath: "/articles" };
  if (articles.some(article => article.status === "已生成" || article.status === "待质检")) return { completedStep: "GEO 文章已生成", nextAction: "有文章但未质检：进行 GEO 内容质量评分", buttonText: "进行质量评分", targetPath: "/articles" };
  if (articles.some(article => article.status === "待审核" || article.status === "质检通过")) return { completedStep: "GEO 内容质检通过", nextAction: "质检通过但未审核：人工审核文章", buttonText: "人工审核文章", targetPath: "/articles" };
  if (articles.some(article => article.status === "审核通过")) return { completedStep: "文章已审核通过", nextAction: "审核通过但未发布：发布到 GEO 内容页", buttonText: "发布到内容页", targetPath: "/articles" };
  if (articles.some(article => article.status === "已发布") || records.length > 0) return { completedStep: "GEO 文章已发布", nextAction: "已发布：等待复测", buttonText: "查看发布记录", targetPath: "/articles" };
  return undefined;
}

function ProjectSelector({ selectedProjectId, setProjectId, projects }: { selectedProjectId?: number; setProjectId: (id: number | undefined) => void; projects: Array<{ id: number; enterpriseName: string; industry: string; status: string | null }> }) {
  const selectedProject = projects.find(project => project.id === selectedProjectId);
  const hintInput = { projectId: selectedProjectId };
  const tasksHintQuery = trpc.geo.tasks.list.useQuery(hintInput, { enabled: Boolean(selectedProjectId && selectedProject?.status === "report_ready") });
  const topicsHintQuery = trpc.geo.articles.topics.list.useQuery(hintInput, { enabled: Boolean(selectedProjectId && selectedProject?.status === "report_ready") });
  const articlesHintQuery = trpc.geo.articles.list.useQuery(hintInput, { enabled: Boolean(selectedProjectId && selectedProject?.status === "report_ready") });
  const recordsHintQuery = trpc.geo.articles.publishRecords.useQuery(hintInput, { enabled: Boolean(selectedProjectId && selectedProject?.status === "report_ready") });
  const articleHint = selectedProject?.status === "report_ready" ? resolveArticleStepHint(tasksHintQuery.data ?? [], topicsHintQuery.data ?? [], articlesHintQuery.data ?? [], recordsHintQuery.data ?? []) : undefined;
  if (projects.length === 0) {
    return <EmptyState title="请先创建企业项目" description="后续问题生成、回答导入、语义分析和 GEO 评分都必须基于真实企业项目进行。" />;
  }
  return (
    <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <Select label="当前企业项目" value={selectedProjectId ? String(selectedProjectId) : "none"} onChange={value => setProjectId(value === "none" ? undefined : Number(value))}>
        <option value="none">请选择项目</option>
        {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}｜{project.industry}</option>)}
      </Select>
      <ProjectProgressCard project={selectedProject} articleHint={articleHint} />
    </div>
  );
}

function toProjectPayload(form: ProjectFormState) {
  return {
    enterpriseName: form.enterpriseName,
    industry: form.industry,
    website: form.website,
    region: form.region,
    productIntro: form.productIntro,
    targetCustomers: form.targetCustomers,
    coreSellingPoints: form.coreSellingPoints,
    competitorNames: splitList(form.competitorNamesText),
    coreKeywords: splitList(form.coreKeywordsText),
  };
}

export function ProjectsPage() {
  const utils = trpc.useUtils();
  const projectsQuery = trpc.geo.projects.list.useQuery();
  const createProject = trpc.geo.projects.create.useMutation({ onSuccess: async () => { await utils.geo.projects.list.invalidate(); toast.success("项目已创建"); } });
  const updateProject = trpc.geo.projects.update.useMutation({ onSuccess: async () => { await utils.geo.projects.list.invalidate(); toast.success("项目已更新"); } });
  const deleteProject = trpc.geo.projects.delete.useMutation({ onSuccess: async () => { await utils.geo.projects.list.invalidate(); toast.success("项目已删除"); } });
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = toProjectPayload(form);
    if (editingId) updateProject.mutate({ id: editingId, ...payload });
    else createProject.mutate(payload);
    setForm(emptyProjectForm);
    setEditingId(null);
  };

  const startEdit = (project: any) => {
    setEditingId(project.id);
    setForm({
      enterpriseName: project.enterpriseName,
      industry: project.industry,
      website: project.website,
      region: project.region,
      productIntro: project.productIntro,
      targetCustomers: project.targetCustomers,
      coreSellingPoints: project.coreSellingPoints,
      competitorNamesText: joinList(project.competitorNames),
      coreKeywordsText: joinList(project.coreKeywords),
    });
  };

  return (
    <div>
      <PageHeader title="项目管理" description="创建企业项目并维护行业、官网、地区、产品介绍、目标客户、核心卖点、竞品和关键词信息。" />
      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{editingId ? "编辑项目" : "新建项目"}</h2>
          <form onSubmit={submit} className="space-y-4">
            <Input label="企业名称" value={form.enterpriseName} onChange={value => setForm({ ...form, enterpriseName: value })} />
            <Input label="行业" value={form.industry} onChange={value => setForm({ ...form, industry: value })} />
            <Input label="官网" value={form.website} onChange={value => setForm({ ...form, website: value })} />
            <Input label="所在地区" value={form.region} onChange={value => setForm({ ...form, region: value })} />
            <TextArea label="产品/服务介绍" value={form.productIntro} onChange={value => setForm({ ...form, productIntro: value })} />
            <TextArea label="目标客户" value={form.targetCustomers} onChange={value => setForm({ ...form, targetCustomers: value })} rows={3} />
            <TextArea label="核心卖点" value={form.coreSellingPoints} onChange={value => setForm({ ...form, coreSellingPoints: value })} rows={3} />
            <TextArea label="竞品名称（多个用逗号或换行分隔）" value={form.competitorNamesText} onChange={value => setForm({ ...form, competitorNamesText: value })} rows={2} />
            <TextArea label="核心关键词（多个用逗号或换行分隔）" value={form.coreKeywordsText} onChange={value => setForm({ ...form, coreKeywordsText: value })} rows={2} />
            <div className="flex gap-2">
              <Button type="submit" disabled={createProject.isPending || updateProject.isPending}>{editingId ? "保存修改" : "创建项目"}</Button>
              {editingId ? <Button variant="secondary" onClick={() => { setEditingId(null); setForm(emptyProjectForm); }}>取消编辑</Button> : null}
            </div>
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">项目列表</h2>
          {projectsQuery.isLoading ? <p className="text-sm text-slate-600">正在加载项目...</p> : null}
          {(projectsQuery.data ?? []).length === 0 && !projectsQuery.isLoading ? <EmptyState title="暂无企业项目" description="请先创建企业项目。系统不会生成假项目或假分析结果。" /> : null}
          <div className="space-y-3">
            {(projectsQuery.data ?? []).map(project => (
              <div key={project.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-950">{project.enterpriseName}</h3>
                    <p className="mt-1 text-sm text-slate-600">{project.industry}｜{project.region}｜{project.website}</p>
                    <p className="mt-2 text-sm text-slate-700">核心关键词：{joinList(project.coreKeywords) || "未填写"}</p>
                    <p className="mt-1 text-sm text-slate-700">竞品：{joinList(project.competitorNames) || "未填写"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(project)}>编辑</Button>
                    <Button variant="danger" onClick={() => window.confirm("确定删除该项目及其关联数据吗？") && deleteProject.mutate({ id: project.id })}>删除</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function QuestionsPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setProjectId, projectInput } = useSelectedProject();
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput);
  const createQuestion = trpc.geo.questions.create.useMutation({ onSuccess: async () => { await Promise.all([utils.geo.questions.list.invalidate(), utils.geo.projects.list.invalidate()]); toast.success("问题已保存"); }, onError: error => toast.error(error.message) });
  const updateQuestion = trpc.geo.questions.update.useMutation({ onSuccess: async () => { await utils.geo.questions.list.invalidate(); toast.success("问题已更新"); }, onError: error => toast.error(error.message) });
  const deleteQuestion = trpc.geo.questions.delete.useMutation({ onSuccess: async () => { await utils.geo.questions.list.invalidate(); toast.success("问题已删除"); } });
  const toggleQuestion = trpc.geo.questions.toggle.useMutation({ onSuccess: async () => utils.geo.questions.list.invalidate() });
  const generateQuestions = trpc.geo.questions.generate.useMutation({ onSuccess: async result => { await Promise.all([utils.geo.questions.list.invalidate(), utils.geo.projects.list.invalidate()]); toast.success(`已生成 ${result.count} 个问题`); }, onError: error => toast.error(error.message) });
  const batchAddSpecified = trpc.geo.questions.batchAddSpecified.useMutation({ onSuccess: async result => { await Promise.all([utils.geo.questions.list.invalidate(), utils.geo.projects.list.invalidate()]); toast.success(`新增 ${result.addedCount} 条，跳过重复 ${result.skippedDuplicateCount} 条，当前共 ${result.totalCount} 条`); }, onError: error => toast.error(error.message) });
  const importSpecifiedCsvRows = trpc.geo.questions.importSpecifiedCsvRows.useMutation({ onSuccess: async result => { await Promise.all([utils.geo.questions.list.invalidate(), utils.geo.projects.list.invalidate()]); toast.success(`新增 ${result.addedCount} 条，跳过重复 ${result.skippedDuplicateCount} 条，当前共 ${result.totalCount} 条`); }, onError: error => toast.error(error.message) });
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<typeof questionTypes[number]>("品牌认知");
  const [bulkText, setBulkText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return toast.error("请先选择项目");
    const payload = { projectId: selectedProjectId, questionText, questionType, enabled: true, source: "manual" as const };
    if (editingId) updateQuestion.mutate({ id: editingId, ...payload });
    else createQuestion.mutate(payload);
    setQuestionText("");
    setEditingId(null);
  };

  const submitBulk = () => {
    if (!selectedProjectId) return toast.error("请先选择项目");
    const rows = bulkText.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    if (rows.length === 0) return toast.error("请粘贴至少 1 行指定问题");
    batchAddSpecified.mutate({ projectId: selectedProjectId, questions: rows });
    setBulkText("");
  };

  const downloadCsvTemplate = () => {
    const csv = "question_text,question_type,target_keyword,intent_level,business_value\n知识付费 SaaS 平台哪个好？,指定问题,知识付费 SaaS,高,5\n海豚知道和小鹅通有什么区别？,指定问题,海豚知道,高,5\n";
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "指定问题导入模板.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const onQuestionCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProjectId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      const headers = rows[0] ?? [];
      const dataRows = rows.slice(1);
      const get = (row: string[], names: string[]) => {
        const index = headers.findIndex(header => names.includes(header.trim()));
        return index >= 0 ? row[index] : "";
      };
      const payload = dataRows.map(row => {
        const type = get(row, ["question_type", "问题类型", "questionType"]);
        const value = Number(get(row, ["business_value", "业务价值", "businessValue"]));
        return {
          questionText: get(row, ["question_text", "问题", "question", "questionText"]),
          questionType: (questionTypes as readonly string[]).includes(type) ? type as typeof questionTypes[number] : "指定问题" as const,
          targetKeyword: get(row, ["target_keyword", "目标关键词", "targetKeyword"]) || null,
          intentLevel: get(row, ["intent_level", "意图等级", "intentLevel"]) || "高",
          businessValue: Number.isFinite(value) && value >= 1 && value <= 5 ? value : 5,
        };
      }).filter(row => row.questionText);
      if (payload.length === 0) return toast.error("CSV 未识别到有效问题，请确认表头包含 question_text");
      importSpecifiedCsvRows.mutate({ projectId: selectedProjectId, rows: payload });
    };
    reader.readAsText(file, "utf-8");
    event.currentTarget.value = "";
  };

  return (
    <div>
      <PageHeader title="问题库" description="根据企业信息调用 AI 生成 50 个提问，也支持客户指定问题的批量添加、CSV 导入、编辑、删除、启用或禁用。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["AI 是否提及品牌", "读取真实回答中的 mentionsEnterprise 字段，避免用主观印象判断品牌可见度。"],
          ["AI 是否推荐品牌", "区分仅被提到与被明确推荐，作为推荐率和后续评分依据。"],
          ["推荐竞品", "记录 AI 优先推荐的竞品名称，用于判断竞品压制与差异化内容缺口。"],
          ["未推荐原因", "保留 notRecommendedReason，不把缺失信息包装成确定性优势。"],
          ["内容缺口", "把错误认知、FAQ 缺口、案例缺口和对比页缺口沉淀为内容策略。"],
          ["人工修订状态", "原始 AI 分析与人工修订分层保存，后续评分、任务和报告优先使用已审核结论。"],
        ].map(([title, desc]) => <div key={title} className="rounded-2xl border border-cyan-300/10 bg-slate-950/55 p-4 text-slate-100 shadow-[0_0_24px_rgba(34,211,238,0.08)]"><p className="text-sm font-semibold text-cyan-100">{title}</p><p className="mt-2 text-xs leading-5 text-slate-400">{desc}</p></div>)}
      </section> : null}
      {selectedProjectId ? <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">问题操作</h2>
          <div className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">AI 生成结果直接来自当前企业信息，不会用假问题补齐；客户指定问题会进入后续 AI 回答导入、分析、评分和报告链路。</div>
          <Button disabled={generateQuestions.isPending} onClick={() => generateQuestions.mutate({ projectId: selectedProjectId })}>{generateQuestions.isPending ? "正在生成..." : "AI 生成 50 个问题"}</Button>
          <form onSubmit={submit} className="mt-6 space-y-4 border-t pt-5">
            <h3 className="font-medium">手动新增单个问题</h3>
            <TextArea label="问题内容" value={questionText} onChange={setQuestionText} />
            <Select label="问题类型" value={questionType} onChange={value => setQuestionType(value as typeof questionTypes[number])}>{questionTypes.map(type => <option key={type} value={type}>{type}</option>)}</Select>
            <Button type="submit">{editingId ? "保存问题" : "新增问题"}</Button>
          </form>
          <div className="mt-6 space-y-4 border-t pt-5">
            <h3 className="font-medium">批量添加指定问题</h3>
            <TextArea label="每行一个指定问题" value={bulkText} onChange={setBulkText} rows={6} placeholder={"知识付费 SaaS 平台哪个好？\n海豚知道和小鹅通有什么区别？\n企业 AI 经营系统有哪些服务商？"} />
            <Button disabled={batchAddSpecified.isPending} onClick={submitBulk}>{batchAddSpecified.isPending ? "正在添加..." : "批量添加指定问题"}</Button>
          </div>
          <div className="mt-6 border-t pt-5">
            <h3 className="mb-2 font-medium">导入指定问题 CSV</h3>
            <p className="mb-3 text-sm text-slate-600">CSV 表头：question_text、question_type、target_keyword、intent_level、business_value。空字段会自动使用指定问题、高意向、业务价值 5。</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button variant="secondary" onClick={downloadCsvTemplate}>下载指定问题 CSV 模板</Button>
              <input type="file" accept=".csv,text/csv" onChange={onQuestionCsv} className="text-sm" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">问题列表</h2>
              <p className="mt-1 text-sm text-slate-600">当前共 {(questionsQuery.data ?? []).length} 条问题，AI 生成 {(questionsQuery.data ?? []).filter(question => question.source === "ai_generated").length} 条，指定问题 {(questionsQuery.data ?? []).filter(question => question.source === "manual" || question.source === "csv").length} 条。</p>
            </div>
          </div>
          {(questionsQuery.data ?? []).length === 0 ? <EmptyState title="暂无问题" description="请先点击 AI 生成 50 个问题，或批量添加客户指定问题。" /> : null}
          <div className="space-y-3">
            {(questionsQuery.data ?? []).map(question => (
              <div key={question.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{question.questionType}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{questionSourceLabels[question.source] ?? "AI 生成"}</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">意图：{question.intentLevel ?? "中"}</span>
                      <span className="rounded-full bg-orange-50 px-2 py-1 text-xs text-orange-700">业务价值：{question.businessValue ?? 3}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-950">{question.questionText}</p>
                    <p className="mt-1 text-xs text-slate-500">状态：{question.enabled ? "启用" : "禁用"}{question.targetKeyword ? `｜关键词：${question.targetKeyword}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" onClick={() => { setEditingId(question.id); setQuestionText(question.questionText); setQuestionType(question.questionType); }}>编辑</Button>
                    <Button variant="secondary" onClick={() => toggleQuestion.mutate({ id: question.id, enabled: !question.enabled })}>{question.enabled ? "禁用" : "启用"}</Button>
                    <Button variant="danger" onClick={() => deleteQuestion.mutate({ id: question.id })}>删除</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div> : null}
    </div>
  );
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function ResponsesPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setProjectId, projectInput } = useSelectedProject();
  const responsesQuery = trpc.geo.aiResponses.list.useQuery(projectInput);
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput);
  const createResponse = trpc.geo.aiResponses.create.useMutation({ onSuccess: async () => { await Promise.all([utils.geo.aiResponses.list.invalidate(), utils.geo.projects.list.invalidate()]); toast.success("AI 回答已保存"); }, onError: error => toast.error(error.message) });
  const importRows = trpc.geo.aiResponses.importCsvRows.useMutation({ onSuccess: async result => { await Promise.all([utils.geo.aiResponses.list.invalidate(), utils.geo.projects.list.invalidate()]); toast.success(`已导入 ${result.count} 条回答`); }, onError: error => toast.error(error.message) });
  const deleteResponse = trpc.geo.aiResponses.delete.useMutation({ onSuccess: async () => { await utils.geo.aiResponses.list.invalidate(); toast.success("AI 回答已删除"); } });
  const [questionId, setQuestionId] = useState("manual");
  const [questionText, setQuestionText] = useState("");
  const [aiPlatform, setAiPlatform] = useState<typeof platforms[number]>("ChatGPT");
  const [rawAnswer, setRawAnswer] = useState("");
  const [checkedAt, setCheckedAt] = useState(nowLocalValue());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return toast.error("请先选择项目");
    const selectedQuestion = (questionsQuery.data ?? []).find(item => String(item.id) === questionId);
    createResponse.mutate({ projectId: selectedProjectId, questionId: selectedQuestion?.id ?? null, questionText: selectedQuestion?.questionText ?? questionText, aiPlatform, rawAnswer, checkedAt });
    setQuestionText("");
    setRawAnswer("");
    setCheckedAt(nowLocalValue());
  };

  const onCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProjectId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      const headers = rows[0] ?? [];
      const dataRows = rows.slice(1);
      const get = (row: string[], names: string[]) => {
        const index = headers.findIndex(header => names.includes(header.trim()));
        return index >= 0 ? row[index] : "";
      };
      const payload = dataRows.map(row => ({
        projectId: selectedProjectId,
        questionId: null,
        questionText: get(row, ["问题", "question", "questionText"]),
        aiPlatform: (platforms as readonly string[]).includes(get(row, ["AI 平台", "AI平台", "platform", "aiPlatform"])) ? get(row, ["AI 平台", "AI平台", "platform", "aiPlatform"]) as typeof platforms[number] : "其他" as const,
        rawAnswer: get(row, ["AI 原始回答", "AI原始回答", "原始回答", "rawAnswer", "answer"]),
        checkedAt: get(row, ["检测时间", "checkedAt", "time"]),
      })).filter(row => row.questionText && row.rawAnswer && row.checkedAt);
      if (payload.length === 0) return toast.error("CSV 未识别到有效数据，请确认表头包含：问题、AI 平台、AI 原始回答、检测时间");
      importRows.mutate({ rows: payload });
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <div>
      <PageHeader title="AI 认知扫描" description="手动录入或通过 CSV 批量导入来自 ChatGPT、DeepSeek、豆包、Kimi、通义、文心、Perplexity 等平台的真实回答，扫描 AI 是否提及/推荐品牌、推荐竞品、未推荐原因、内容缺口和人工修订状态。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["AI 是否提及品牌", "读取真实回答中的 mentionsEnterprise 字段，避免用主观印象判断品牌可见度。"],
          ["AI 是否推荐品牌", "区分仅被提到与被明确推荐，作为推荐率和后续评分依据。"],
          ["推荐竞品", "记录 AI 优先推荐的竞品名称，用于判断竞品压制与差异化内容缺口。"],
          ["未推荐原因", "保留 notRecommendedReason，不把缺失信息包装成确定性优势。"],
          ["内容缺口", "把错误认知、FAQ 缺口、案例缺口和对比页缺口沉淀为内容策略。"],
          ["人工修订状态", "原始 AI 分析与人工修订分层保存，后续评分、任务和报告优先使用已审核结论。"],
        ].map(([title, desc]) => <div key={title} className="rounded-2xl border border-cyan-300/10 bg-slate-950/55 p-4 text-slate-100 shadow-[0_0_24px_rgba(34,211,238,0.08)]"><p className="text-sm font-semibold text-cyan-100">{title}</p><p className="mt-2 text-xs leading-5 text-slate-400">{desc}</p></div>)}
      </section> : null}
      {selectedProjectId ? <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">手动录入</h2>
          <form onSubmit={submit} className="space-y-4">
            <Select label="关联问题" value={questionId} onChange={setQuestionId}>
              <option value="manual">手动填写问题</option>
              {(questionsQuery.data ?? []).map(question => <option key={question.id} value={question.id}>{question.questionText}</option>)}
            </Select>
            {questionId === "manual" ? <TextArea label="问题" value={questionText} onChange={setQuestionText} /> : null}
            <Select label="AI 平台" value={aiPlatform} onChange={value => setAiPlatform(value as typeof platforms[number])}>{platforms.map(platform => <option key={platform} value={platform}>{platform}</option>)}</Select>
            <TextArea label="AI 原始回答" value={rawAnswer} onChange={setRawAnswer} rows={8} />
            <Input label="检测时间" type="datetime-local" value={checkedAt} onChange={setCheckedAt} />
            <Button type="submit">录入 AI 回答</Button>
          </form>
          <div className="mt-6 border-t pt-5">
            <h3 className="mb-2 font-medium">CSV 批量导入</h3>
            <p className="mb-3 text-sm text-slate-600">CSV 表头需包含：问题、AI 平台、AI 原始回答、检测时间。不会用空行或缺失字段生成分析。</p>
            <input type="file" accept=".csv,text/csv" onChange={onCsv} className="text-sm" />
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">已导入 AI 回答</h2>
          {(responsesQuery.data ?? []).length === 0 ? <EmptyState title="暂无 AI 回答" description="请先手动录入或导入 CSV。没有真实回答时，系统不会生成语义分析、评分或报告。" /> : null}
          <div className="space-y-3">
            {(responsesQuery.data ?? []).map(response => <div key={response.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{response.aiPlatform}</span><p className="mt-2 text-sm font-medium">{response.questionText}</p><p className="mt-2 line-clamp-3 text-sm text-slate-600">{response.rawAnswer}</p><p className="mt-2 text-xs text-slate-500">检测时间：{new Date(response.checkedAt).toLocaleString()}</p></div><Button variant="danger" onClick={() => deleteResponse.mutate({ id: response.id })}>删除</Button></div></div>)}
          </div>
        </Card>
      </div> : null}
    </div>
  );
}

export function AnalysisPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setProjectId, projectInput } = useSelectedProject();
  const responsesQuery = trpc.geo.aiResponses.list.useQuery(projectInput);
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput);
  const runAnalysis = trpc.geo.analysis.run.useMutation({ onSuccess: async result => { await Promise.all([utils.geo.analysis.list.invalidate(), utils.geo.projects.list.invalidate()]); toast.success(`已完成 ${result.count} 条分析`); }, onError: error => toast.error(error.message) });
  const saveManualReview = trpc.geo.analysis.saveManualReview.useMutation({ onSuccess: async () => { await utils.geo.analysis.list.invalidate(); toast.success("人工修订已保存"); closeManualReview(); }, onError: error => toast.error(error.message) });
  const undoManualReview = trpc.geo.analysis.undoManualReview.useMutation({ onSuccess: async () => { await utils.geo.analysis.list.invalidate(); toast.success("已撤销人工修订"); }, onError: error => toast.error(error.message) });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [manualForm, setManualForm] = useState({
    mentionsEnterprise: false,
    recommendsEnterprise: false,
    mentionsCompetitors: false,
    recommendedCompetitorsText: "",
    enterpriseWins: false,
    recommendationReason: "",
    notRecommendedReason: "",
    hasMisconception: false,
    contentGap: "",
    optimizationSuggestion: "",
    confidence: "80",
    reviewNote: "",
  });
  const openManualReview = (item: NonNullable<typeof analysisQuery.data>[number]) => {
    const override = item.manualOverrideJson as Record<string, unknown> | null;
    setEditingId(item.id);
    setManualForm({
      mentionsEnterprise: Boolean(item.mentionsEnterprise),
      recommendsEnterprise: Boolean(item.recommendsEnterprise),
      mentionsCompetitors: Boolean(item.mentionsCompetitors),
      recommendedCompetitorsText: joinList(item.recommendedCompetitors),
      enterpriseWins: Boolean(item.enterpriseWins),
      recommendationReason: item.recommendationReason ?? "",
      notRecommendedReason: item.notRecommendedReason ?? "",
      hasMisconception: Boolean(item.hasMisconception),
      contentGap: item.contentGap ?? "",
      optimizationSuggestion: item.optimizationSuggestion ?? "",
      confidence: typeof override?.confidence === "number" ? String(override.confidence) : "80",
      reviewNote: item.reviewNote ?? "",
    });
  };
  const closeManualReview = () => setEditingId(null);
  const updateManualForm = (key: keyof typeof manualForm, value: string | boolean) => setManualForm(prev => ({ ...prev, [key]: value }));
  const submitManualReview = () => {
    if (!editingId) return;
    const confidenceValue = manualForm.confidence.trim() ? Number(manualForm.confidence) : null;
    if (confidenceValue !== null && (!Number.isFinite(confidenceValue) || confidenceValue < 0 || confidenceValue > 100)) return toast.error("置信度需填写 0-100 之间的数字");
    saveManualReview.mutate({
      id: editingId,
      mentionsEnterprise: manualForm.mentionsEnterprise,
      recommendsEnterprise: manualForm.recommendsEnterprise,
      mentionsCompetitors: manualForm.mentionsCompetitors,
      recommendedCompetitors: splitList(manualForm.recommendedCompetitorsText),
      enterpriseWins: manualForm.enterpriseWins,
      recommendationReason: manualForm.recommendationReason,
      notRecommendedReason: manualForm.notRecommendedReason,
      hasMisconception: manualForm.hasMisconception,
      contentGap: manualForm.contentGap,
      optimizationSuggestion: manualForm.optimizationSuggestion,
      confidence: confidenceValue,
      reviewNote: manualForm.reviewNote,
    });
  };
  const editingItem = (analysisQuery.data ?? []).find(item => item.id === editingId);
  return (
    <div>
      <PageHeader title="AI 语义分析" description="调用 LLM 对每条 AI 原始回答进行语义分析，输出结构化 JSON。分析必须基于真实导入回答；如 AI 判断不准确，可人工修订结构化结果供后续评分、任务、模板和报告使用。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <Card>
        {(responsesQuery.data ?? []).length === 0 ? <EmptyState title="暂无可分析的 AI 回答" description="请先到 AI 回答导入页录入或导入真实回答，再运行语义分析。" /> : <div className="mb-5 flex items-center justify-between"><p className="text-sm text-slate-600">当前可分析回答：{responsesQuery.data?.length ?? 0} 条</p><Button disabled={runAnalysis.isPending} onClick={() => runAnalysis.mutate({ projectId: selectedProjectId })}>{runAnalysis.isPending ? "正在分析..." : "运行 AI 语义分析"}</Button></div>}
        {(analysisQuery.data ?? []).length === 0 ? <EmptyState title="暂无分析结果" description="运行语义分析后，系统会展示是否提到本企业、是否推荐、竞品情况、错误认知、内容缺口与优化建议。" /> : null}
        <div className="space-y-4">
          {(analysisQuery.data ?? []).map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-1 text-xs ${item.manuallyReviewed ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{item.manuallyReviewed ? "已人工修订" : "AI 原始分析"}</span>
                {item.manuallyReviewed && item.reviewedAt ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">修订时间：{new Date(item.reviewedAt).toLocaleString()}</span> : null}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openManualReview(item)}>{item.manuallyReviewed ? "编辑修订" : "人工修订"}</Button>
                {item.manuallyReviewed ? <Button variant="danger" onClick={() => undoManualReview.mutate({ id: item.id })}>撤销人工修订</Button> : null}
              </div>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2"><p><b>是否提到本企业：</b>{item.mentionsEnterprise ? "是" : "否"}</p><p><b>是否推荐本企业：</b>{item.recommendsEnterprise ? "是" : "否"}</p><p><b>是否提到竞品：</b>{item.mentionsCompetitors ? "是" : "否"}</p><p><b>本企业是否胜出：</b>{item.enterpriseWins ? "是" : "否"}</p><p><b>被推荐竞品：</b>{joinList(item.recommendedCompetitors) || "无"}</p><p><b>是否存在错误认知：</b>{item.hasMisconception ? "是" : "否"}</p></div>
            <div className="mt-3 space-y-2 text-sm text-slate-700"><p><b>推荐理由：</b>{item.recommendationReason || "无"}</p><p><b>未推荐原因：</b>{item.notRecommendedReason || "无"}</p><p><b>内容缺口：</b>{item.contentGap || "无"}</p><p><b>优化建议：</b>{item.optimizationSuggestion || "无"}</p>{item.reviewNote ? <p><b>修订备注：</b>{item.reviewNote}</p> : null}</div>
            <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-slate-700">查看原始 AI 分析</summary><pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(item.rawJson, null, 2)}</pre></details>
            {item.manuallyReviewed ? <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-slate-700">查看人工修订结果</summary><pre className="mt-2 overflow-auto rounded-lg bg-amber-950 p-3 text-xs text-amber-50">{JSON.stringify(item.manualOverrideJson, null, 2)}</pre></details> : null}
          </div>)}
        </div>
      </Card> : null}
      {editingId && editingItem ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
        <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">人工修订分析结果</h2><p className="mt-1 text-sm text-slate-600">原始 AI 分析不会被覆盖，保存后后续评分、任务、模板和报告会优先使用人工修订结果。</p></div><Button variant="secondary" onClick={closeManualReview}>关闭</Button></div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {[ ["mentionsEnterprise", "是否提到本企业"], ["recommendsEnterprise", "是否推荐本企业"], ["mentionsCompetitors", "是否提到竞品"], ["enterpriseWins", "本企业是否胜出"], ["hasMisconception", "是否存在错误认知"] ].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3"><input type="checkbox" checked={Boolean(manualForm[key as keyof typeof manualForm])} onChange={event => updateManualForm(key as keyof typeof manualForm, event.target.checked)} />{label}</label>)}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextArea label="被推荐竞品" value={manualForm.recommendedCompetitorsText} onChange={value => updateManualForm("recommendedCompetitorsText", value)} placeholder="多个竞品用逗号或换行分隔" />
            <Input label="置信度（0-100）" value={manualForm.confidence} onChange={value => updateManualForm("confidence", value)} type="number" />
            <TextArea label="推荐理由" value={manualForm.recommendationReason} onChange={value => updateManualForm("recommendationReason", value)} />
            <TextArea label="未推荐原因" value={manualForm.notRecommendedReason} onChange={value => updateManualForm("notRecommendedReason", value)} />
            <TextArea label="错误认知 / 内容缺口" value={manualForm.contentGap} onChange={value => updateManualForm("contentGap", value)} />
            <TextArea label="优化建议" value={manualForm.optimizationSuggestion} onChange={value => updateManualForm("optimizationSuggestion", value)} />
            <div className="md:col-span-2"><TextArea label="修订备注" value={manualForm.reviewNote} onChange={value => updateManualForm("reviewNote", value)} placeholder="说明为什么需要修订，可为空" /></div>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={closeManualReview}>取消</Button><Button disabled={saveManualReview.isPending} onClick={submitManualReview}>{saveManualReview.isPending ? "正在保存..." : "保存人工修订"}</Button></div>
        </div>
      </div> : null}
    </div>
  );
}
export function ScoresPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setProjectId, projectInput } = useSelectedProject();
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput);
  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput);
  const calculate = trpc.geo.scores.calculate.useMutation({ onSuccess: async () => { await Promise.all([utils.geo.scores.latest.invalidate(), utils.geo.projects.list.invalidate()]); toast.success("GEO 评分已计算"); }, onError: error => toast.error(error.message) });
  const score = scoreQuery.data;
  return (
    <div>
      <PageHeader title="GEO 评分" description="基于真实 AI 分析结果计算 GEO 总分，权重为 AI 可见度 25%、推荐率 25%、竞品胜出率 20%、认知准确率 15%、内容资产完整度 15%。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <Card>
        {(analysisQuery.data ?? []).length === 0 ? <EmptyState title="暂无可评分的分析结果" description="请先完成 AI 语义分析，再计算 GEO 评分。" /> : <div className="mb-5 flex items-center justify-between"><p className="text-sm text-slate-600">当前分析样本：{analysisQuery.data?.length ?? 0} 条</p><Button disabled={calculate.isPending} onClick={() => calculate.mutate({ projectId: selectedProjectId })}>{calculate.isPending ? "正在计算..." : "计算 GEO 评分"}</Button></div>}
        {!score ? <EmptyState title="暂无 GEO 评分" description="评分只会基于真实分析结果计算，不会展示示例分数。" /> : <div><div className="rounded-xl bg-slate-950 p-6 text-white"><p className="text-sm text-slate-300">GEO 总分</p><p className="mt-2 text-5xl font-semibold">{score.totalScore}</p><p className="mt-2 text-lg">可见度等级：{score.visibilityLevel}</p></div><div className="mt-5 grid gap-3 md:grid-cols-5">{[["AI 可见度", score.aiVisibilityScore, "25%"], ["AI 推荐率", score.aiRecommendationScore, "25%"], ["竞品胜出率", score.competitorWinScore, "20%"], ["认知准确率", score.cognitionAccuracyScore, "15%"], ["内容资产完整度", score.contentAssetScore, "15%"]].map(([label, value, weight]) => <div key={label} className="rounded-lg border border-slate-200 p-4"><p className="text-xs text-slate-500">{label}｜权重 {weight}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div><div className="mt-5 text-sm text-slate-600">等级说明：0-39 弱可见；40-59 初步可见；60-79 良好可见；80-100 强势推荐。</div></div>}
      </Card> : null}
    </div>
  );
}

export function TasksPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setProjectId, projectInput } = useSelectedProject();
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput);
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput);
  const templatesQuery = trpc.geo.templates.list.useQuery(projectInput);
  const generateTasks = trpc.geo.tasks.generate.useMutation({ onSuccess: async result => { await Promise.all([utils.geo.tasks.list.invalidate(), utils.geo.projects.list.invalidate()]); toast.success(`已生成 ${result.count} 条优化任务`); }, onError: error => toast.error(error.message) });
  const updateStatus = trpc.geo.tasks.updateStatus.useMutation({ onSuccess: async () => { await utils.geo.tasks.list.invalidate(); toast.success("任务状态已更新"); }, onError: error => toast.error(error.message) });
  return (
    <div>
      <PageHeader title="优化工作台" description="根据语义分析结果生成官网首页、产品页、竞品对比页、FAQ、客户案例、行业文章和社媒内容任务。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <Card>
        {(analysisQuery.data ?? []).length === 0 ? <EmptyState title="暂无分析结果" description="请先运行 AI 语义分析。优化任务必须来源于真实分析结果，不会凭空生成。" /> : <div className="mb-5 flex items-center justify-between"><p className="text-sm text-slate-600">当前分析样本：{analysisQuery.data?.length ?? 0} 条</p><Button disabled={generateTasks.isPending} onClick={() => generateTasks.mutate({ projectId: selectedProjectId })}>{generateTasks.isPending ? "正在生成..." : "生成优化任务"}</Button></div>}
        {(tasksQuery.data ?? []).length === 0 ? <EmptyState title="暂无优化任务" description="生成任务后，可在此查看任务名称、优先级、生成原因、执行建议、预计影响和状态。" /> : null}
        <div className="space-y-4">{(tasksQuery.data ?? []).map(task => {
          const relatedTemplates = (templatesQuery.data ?? []).filter(template => template.optimizationTaskId === task.id);
          return <div key={task.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{task.taskType}｜{task.priority}</span><h3 className="mt-2 font-semibold">{task.taskName}</h3><p className="mt-2 text-sm text-slate-600"><b>生成原因：</b>{task.generationReason}</p><p className="mt-2 text-sm text-slate-600"><b>执行建议：</b>{task.executionSuggestion}</p><p className="mt-2 text-sm text-slate-600"><b>预计影响：</b>{task.expectedImpact}</p><p className="mt-2 text-sm text-slate-600"><b>已发布链接：</b>{task.publishedUrl || "暂无真实链接，请发布后填写。"}</p><p className="mt-1 text-sm text-slate-600"><b>完成时间：</b>{task.completedAt ? new Date(task.completedAt).toLocaleString() : "未完成"}｜<b>是否待复测：</b>{task.needRetest ? "是" : "否"}</p></div><select value={task.status} onChange={event => { const status = event.target.value as typeof taskStatuses[number]; const publishedUrl = status === "done" ? window.prompt("如已发布，请填写已发布链接，可留空", task.publishedUrl ?? "") : null; const needRetest = status === "done" ? window.confirm("是否需要复测？") : false; updateStatus.mutate({ id: task.id, status, publishedUrl, needRetest }); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{taskStatuses.map(status => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}</select></div>{relatedTemplates.length > 0 ? <div className="mt-4 rounded-lg bg-slate-50 p-3"><p className="mb-2 text-sm font-medium text-slate-800">关联内容模板</p><div className="space-y-2">{relatedTemplates.map(template => <div key={template.id} className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center"><div><p className="text-sm font-medium">{template.title}</p><p className="text-xs text-slate-500">{template.templateType}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => navigator.clipboard.writeText(template.markdownContent).then(() => toast.success("已复制模板"))}>一键复制</Button><Button variant="secondary" onClick={() => downloadMarkdown(`${template.title}.md`, template.markdownContent)}>导出 Markdown</Button></div></div>)}</div></div> : null}</div>;
        })}</div>
      </Card> : null}
    </div>
  );
}

function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setProjectId, projectInput } = useSelectedProject();
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput);
  const templatesQuery = trpc.geo.templates.list.useQuery(projectInput);
  const reportQuery = trpc.geo.reports.latest.useQuery(projectInput);
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput);
  const deliveryReports = [
    { title: "GEO 诊断报告", status: reportQuery.data ? "已生成" : "待生成", detail: "来自真实 AI 回答、语义分析、GEO 评分和优化任务，解释品牌为什么未被提及或推荐。" },
    { title: "内容发布报告", status: (recordsQuery.data ?? []).length > 0 ? `${(recordsQuery.data ?? []).length} 条发布记录` : "待发布", detail: "汇总已发布内容、发布渠道、质量分、公开链接和是否待复测。" },
    { title: "收录监测报告", status: (recordsQuery.data ?? []).some(record => Boolean(record.needRetest)) ? "待人工复测" : "等待样本", detail: "记录搜索收录、AI 提及、AI 推荐和竞品压制变化，不做自动抓取。" },
    { title: "复测报告", status: "人工复测后生成", detail: "对比发布前后 AI 回答变化，说明哪些认知已改善、哪些问题仍需补内容。" },
    { title: "客户交付报告", status: reportQuery.data ? "可整理交付" : "待诊断报告", detail: "面向客户汇总诊断、内容、发布、监测和下一步建议，只引用已确认事实。" },
  ];
  const generateTemplates = trpc.geo.templates.generate.useMutation({ onSuccess: async result => { await Promise.all([utils.geo.templates.list.invalidate(), utils.geo.projects.list.invalidate()]); toast.success(`已生成 ${result.count} 个内容模板`); }, onError: error => toast.error(error.message) });
  const generateReport = trpc.geo.reports.generate.useMutation({ onSuccess: async () => { await Promise.all([utils.geo.reports.latest.invalidate(), utils.geo.projects.list.invalidate()]); toast.success("诊断报告已生成"); }, onError: error => toast.error(error.message) });
  return (
    <div>
      <PageHeader title="客户交付中心" description="面向客户交付 GEO 诊断报告、内容发布报告、收录监测报告、复测报告和客户交付报告，并保留原有内容模板与 Markdown 导出能力。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <div className="space-y-5">
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-cyan-200">客户交付中心</p>
              <h2 className="mt-1 text-xl font-semibold text-white">五类报告交付物</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">报告只读取当前系统中的诊断、资产、文章、发布和复测记录，不会把没有来源的效果数据写成确定性结论。</p>
            </div>
            {(tasksQuery.data ?? []).length === 0 ? null : <div className="flex flex-wrap gap-3"><Button disabled={generateTemplates.isPending} onClick={() => generateTemplates.mutate({ projectId: selectedProjectId })}>{generateTemplates.isPending ? "正在生成模板..." : "生成内容模板"}</Button><Button disabled={generateReport.isPending} onClick={() => generateReport.mutate({ projectId: selectedProjectId })}>{generateReport.isPending ? "正在生成报告..." : "生成GEO 诊断报告"}</Button></div>}
          </div>
          {(tasksQuery.data ?? []).length === 0 ? <div className="mt-4"><EmptyState title="暂无优化任务" description="请先在优化工作台生成任务，再生成内容模板和诊断报告。" /></div> : null}
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {deliveryReports.map(report => <div key={report.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-sm font-semibold text-white">{report.title}</p><span className="mt-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100">{report.status}</span><p className="mt-3 text-xs leading-5 text-slate-400">{report.detail}</p></div>)}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">内容模板</h2>
          {(templatesQuery.data ?? []).length === 0 ? <EmptyState title="暂无内容模板" description="模板只会根据已生成的优化任务创建，不会展示英文占位符或假模板。" /> : null}
          <div className="space-y-4">{(templatesQuery.data ?? []).map(template => { const relatedTask = (tasksQuery.data ?? []).find(task => task.id === template.optimizationTaskId); return <div key={template.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{template.templateType}</span><h3 className="mt-2 font-semibold">{template.title}</h3><p className="mt-1 text-xs text-slate-500">关联优化任务：{relatedTask?.taskName ?? "未绑定任务"}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => navigator.clipboard.writeText(template.markdownContent).then(() => toast.success("已复制模板"))}>一键复制</Button><Button variant="secondary" onClick={() => downloadMarkdown(`${template.title}.md`, template.markdownContent)}>导出 Markdown</Button></div></div><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{template.markdownContent}</pre></div>; })}</div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">GEO 诊断报告</h2>
          {!reportQuery.data ? <EmptyState title="暂无诊断报告" description="请先完成分析、评分和任务生成，再生成报告。报告内容会来自真实导入与计算结果。" /> : <div><div className="mb-3 flex gap-2"><Button variant="secondary" onClick={() => navigator.clipboard.writeText(reportQuery.data?.markdownContent ?? "").then(() => toast.success("已复制报告"))}>一键复制</Button><Button variant="secondary" onClick={() => downloadMarkdown(`${(reportQuery.data?.oneSentenceConclusion ?? "GEO诊断报告").slice(0, 20)}.md`, reportQuery.data?.markdownContent ?? "")}>导出 Markdown</Button></div><pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm text-slate-100">{reportQuery.data?.markdownContent ?? ""}</pre></div>}
        </Card>
      </div> : null}
    </div>
  );
}

type QualityScoreView = {
  articleId: number;
  problemMatchScore: number;
  evidenceScore: number;
  structureScore: number;
  originalityScore: number;
  geoCitableScore: number;
  complianceScore: number;
  totalScore: number;
  blocked: number;
  blockReasons: string[];
  reviewSummary: string;
  createdAt: Date | string;
};

const articleStatusStyles: Record<string, string> = {
  待生成: "bg-slate-100 text-slate-700",
  已生成: "bg-blue-50 text-blue-700",
  待质检: "bg-indigo-50 text-indigo-700",
  质检通过: "bg-emerald-50 text-emerald-700",
  质检未通过: "bg-red-50 text-red-700",
  待审核: "bg-amber-50 text-amber-700",
  审核通过: "bg-green-50 text-green-700",
  审核未通过: "bg-red-50 text-red-700",
  已发布: "bg-purple-50 text-purple-700",
  待复测: "bg-cyan-50 text-cyan-700",
};

const qualityDimensions: Array<[keyof QualityScoreView, string, number]> = [
  ["problemMatchScore", "问题匹配度", 20],
  ["evidenceScore", "内容证据强度", 20],
  ["structureScore", "结构化程度", 15],
  ["originalityScore", "原创与信息增量", 15],
  ["geoCitableScore", "GEO 可引用性", 15],
  ["complianceScore", "合规与可信度", 15],
];

const thirdPartyPlatformLabels: Record<string, string> = {
  "GEO 内容页版": "GEO 内容页版",
  "官网版": "官网版",
  "公众号长文版": "公众号长文版",
  "知乎回答版": "知乎回答版",
  "小红书笔记版": "小红书笔记版",
  "百家号/头条号版": "百家号/头条号版",
  xiaohongshu: "小红书",
  zhihu: "知乎",
  wechat: "公众号",
  baijiahao: "百家号",
  toutiao: "头条号",
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${articleStatusStyles[status] ?? "bg-slate-100 text-slate-700"}`}>{status}</span>;
}

function scoreForArticle(scores: QualityScoreView[], articleId: number) {
  return scores.find(score => score.articleId === articleId) ?? null;
}

function publicUrl(path?: string | null) {
  if (!path) return "";
  return `${window.location.origin}${path}`;
}

type ArticleGenerationBasisView = {
  customerQuestion?: string;
  contentGap?: string;
  optimizationTaskName?: string;
  optimizationTask?: string;
  notRecommendedReason?: string;
  competitorGap?: string;
  humanRevisionConclusion?: string;
  manualReviewConclusion?: string;
  assetLibraryUsage?: {
    enterpriseMaterials?: Array<{ title?: string; sourceType?: string; trustLevel?: string; isPublic?: boolean }>;
    competitorMaterials?: Array<{ competitorName?: string; differentiation?: string }>;
    customerCaseUsage?: { used?: boolean; status?: string };
    complianceRules?: string[];
    contentStyles?: string[];
    publishStrategy?: string[];
    missingEvidenceNotes?: string[];
  };
};

type ArticleCitableSnippetView = {
  question?: string;
  answer?: string;
};

function generationBasisRows(basis: ArticleGenerationBasisView | null): Array<[string, string]> {
  if (!basis) return [];
  const rows: Array<[string, string]> = [
    ["客户指定问题", basis.customerQuestion ?? ""],
    ["内容缺口", basis.contentGap ?? ""],
    ["优化任务", basis.optimizationTaskName ?? basis.optimizationTask ?? ""],
    ["AI 未推荐原因", basis.notRecommendedReason ?? ""],
    ["竞品差距", basis.competitorGap ?? ""],
    ["人工修订结论", basis.humanRevisionConclusion ?? basis.manualReviewConclusion ?? ""],
    ["使用了哪些企业资料", basis.assetLibraryUsage?.enterpriseMaterials?.map(item => `${item.title ?? "未命名资料"}（${item.sourceType ?? "资料"}，${item.trustLevel ?? "可信度未标注"}，${item.isPublic ? "可公开" : "不可公开"}）`).join("；") ?? ""],
    ["使用了哪些竞品资料", basis.assetLibraryUsage?.competitorMaterials?.map(item => `${item.competitorName ?? "未命名竞品"}：${item.differentiation ?? "差异待补充"}`).join("；") ?? ""],
    ["是否使用客户案例", basis.assetLibraryUsage?.customerCaseUsage?.status ?? ""],
    ["是否使用合规规则", basis.assetLibraryUsage?.complianceRules?.join("；") ?? ""],
    ["是否使用内容风格", basis.assetLibraryUsage?.contentStyles?.join("；") ?? ""],
    ["是否使用发布策略", basis.assetLibraryUsage?.publishStrategy?.join("；") ?? ""],
    ["证据缺口", basis.assetLibraryUsage?.missingEvidenceNotes?.join("；") ?? ""],
  ];
  return rows.filter(([, value]) => value.trim().length > 0);
}

function hasRequiredBasis(basis: ArticleGenerationBasisView | null) {
  return generationBasisRows(basis).length >= 5;
}

export function ArticlesPage() {
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const isPublishRoute = location === "/publish";
  const { projects, selectedProjectId, setProjectId, projectInput } = useSelectedProject();
  const topicsQuery = trpc.geo.articles.topics.list.useQuery(projectInput);
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput);
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput);
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput);
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput);
  const generateTopics = trpc.geo.articles.topics.generate.useMutation({
    onSuccess: async result => { await utils.geo.articles.topics.list.invalidate(); toast.success(`已生成 ${result.count} 个文章选题`); },
    onError: error => toast.error(error.message),
  });
  const generateArticle = trpc.geo.articles.generate.useMutation({
    onSuccess: async () => { await Promise.all([utils.geo.articles.list.invalidate(), utils.geo.articles.topics.list.invalidate()]); toast.success("文章初稿已生成"); },
    onError: error => toast.error(error.message),
  });
  const qualityCheck = trpc.geo.articles.qualityCheck.useMutation({
    onSuccess: async result => { await Promise.all([utils.geo.articles.list.invalidate(), utils.geo.articles.latestQualityScores.invalidate()]); toast[result.success ? "success" : "error"](result.success ? "质检通过，可进入人工审核" : "质检未通过，已阻断发布"); },
    onError: error => toast.error(error.message),
  });
  const auditArticle = trpc.geo.articles.audit.useMutation({
    onSuccess: async () => { await utils.geo.articles.list.invalidate(); toast.success("人工审核状态已更新"); },
    onError: error => toast.error(error.message),
  });
  const publishArticle = trpc.geo.articles.publish.useMutation({
    onSuccess: async result => { await Promise.all([utils.geo.articles.list.invalidate(), utils.geo.articles.publishRecords.invalidate(), utils.geo.tasks.list.invalidate()]); toast.success(`已发布到内置内容页：${result.publicPath}`); },
    onError: error => toast.error(error.message),
  });

  const qualityScores = (scoresQuery.data ?? []) as QualityScoreView[];
  const taskById = new Map((tasksQuery.data ?? []).map(task => [task.id, task]));
  const articles = articlesQuery.data ?? [];
  const topics = topicsQuery.data ?? [];
  const records = recordsQuery.data ?? [];
  const articleRecordById = new Map(records.map(record => [record.articleId, record]));
  const reviewedCount = articles.filter(article => ["质检通过", "待审核", "审核通过", "已发布"].includes(article.status)).length;
  const publishableCount = articles.filter(article => {
    const score = scoreForArticle(qualityScores, article.id);
    return Boolean(score && !score.blocked && score.totalScore >= 80 && ["质检通过", "待审核", "审核通过", "已发布"].includes(article.status));
  }).length;
  const opportunityStats = [
    { label: "内容机会池", value: `${topics.length} 个`, detail: "来自客户问题、内容缺口、优化任务和人工修订结论。" },
    { label: "文章列表", value: `${articles.length} 篇`, detail: "每篇文章必须保留生成依据和发布准入结论。" },
    { label: "GEO 内容质量评分", value: `${qualityScores.length} 次`, detail: "低于 80 分或有阻断风险时禁止发布。" },
    { label: "允许发布", value: `${publishableCount} 篇`, detail: "必须同时满足质检、依据和人工审核要求。" },
    { label: "已发布内容", value: `${records.length} 篇`, detail: "仅发布到内置 GEO 内容页，第三方平台只生成素材。" },
    { label: "待人工审核", value: `${Math.max(articles.length - reviewedCount, 0)} 篇`, detail: "人工审核确认后才允许进入发布动作。" },
  ];
  const qualityLabel = (score: QualityScoreView | null | undefined) => {
    if (!score) return { text: "未评分：发布前必须先完成 GEO 内容质量评分", className: "bg-slate-100 text-slate-700" };
    if (score.blocked || score.totalScore < 80) return { text: "80 分以下：禁止发布", className: "bg-red-50 text-red-700" };
    if (score.totalScore >= 90) return { text: "90 分以上：优质 GEO 内容，可优先发布", className: "bg-emerald-50 text-emerald-700" };
    return { text: "80-89 分：建议优化后发布", className: "bg-amber-50 text-amber-700" };
  };
  const platformPlan = (article: NonNullable<typeof articlesQuery.data>[number], basis: ArticleGenerationBasisView | null, score: QualityScoreView | null | undefined) => {
    const hasPublicEvidence = hasRequiredBasis(basis);
    const isHighQuality = Boolean(score && !score.blocked && score.totalScore >= 80);
    return {
      first: isHighQuality && hasPublicEvidence ? "GEO 内容页 / 官网知识库" : "暂不进入外部平台，先补依据与质检",
      second: isHighQuality ? "知乎回答 / 公众号长文" : "仅保留内部草稿",
      blocked: hasPublicEvidence ? "证据不足的平台化夸大表达" : "小红书、百家号、头条号等需要强证据的外部分发",
      reason: basis?.contentGap ? `优先补齐“${basis.contentGap}”相关 AI 内容缺口，并服务关联客户问题。` : "平台优先级基于当前优化任务、质量分和可公开证据生成。",
      form: article.articleType.includes("问答") ? "问答型短答案、FAQ、AI 可引用片段" : "长文解读、FAQ、竞品对比段、AI 可引用摘要",
      note: "第三方平台当前只生成素材，不自动登录发布；发布前需要人工确认标题、案例、数据、合规词和平台规则。",
      metric: "复测指标：搜索收录状态、AI 提及状态、AI 推荐状态、关联问题回答变化、竞品胜出率变化。",
    };
  };

  return (
    <div>
      <PageHeader title={isPublishRoute ? "平台发布" : "内容生产"} description={isPublishRoute ? "平台发布页突出平台优先级、推荐原因、适合内容形式、发布注意事项和复测指标；第三方平台当前只生成素材，不自动登录发布。" : "内容生产页围绕内容机会池、文章列表、GEO 内容质量评分、质量总分、生成依据和是否允许发布，确保每篇文章都来自真实诊断链路。"} />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <div className="space-y-5">
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-cyan-200">{isPublishRoute ? "平台优先级决策台" : "内容生产总览"}</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{isPublishRoute ? "先判断平台，再安排素材与复测" : "内容机会池 → 文章列表 → 质量评分 → 发布准入"}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{isPublishRoute ? "每篇内容必须先明确第一优先级平台、第二优先级平台和不建议平台，避免把未达标内容推向外部分发渠道。" : "每篇文章卡片都会展示关联客户问题、内容缺口、优化任务、目标平台、质量分和是否允许发布。"}</p>
            </div>
            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">第三方平台当前只生成素材，不自动登录发布。</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {opportunityStats.map(item => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-sm font-medium text-cyan-100">{item.label}</p><p className="mt-2 text-2xl font-semibold text-white">{item.value}</p><p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p></div>)}
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">内容机会池</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">选题来源于客户问题、AI 未推荐原因、内容缺口、优化任务和人工修订后的分析结论；不会生成无来源文章。</p>
            </div>
            <Button disabled={generateTopics.isPending} onClick={() => generateTopics.mutate({ projectId: selectedProjectId })}>{generateTopics.isPending ? "正在生成..." : "生成文章选题"}</Button>
          </div>
          {topics.length === 0 ? <div className="mt-5"><EmptyState title="暂无内容机会" description="请先完成 AI 诊断、GEO 评分和优化任务，再生成内容机会池。" /></div> : <div className="mt-5 grid gap-4 lg:grid-cols-2">{topics.map(topic => {
            const relatedTask = topic.optimizationTaskId ? taskById.get(topic.optimizationTaskId) : null;
            return <div key={topic.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-start justify-between gap-3"><div><StatusBadge status={topic.status} /><h3 className="mt-2 font-semibold text-white">{topic.title}</h3><p className="mt-1 text-xs text-slate-400">文章类型：{topic.articleType}｜关联优化任务：{relatedTask?.taskName ?? "未匹配"}</p></div><Button variant="secondary" disabled={generateArticle.isPending || topic.status === "已生成"} onClick={() => generateArticle.mutate({ topicId: topic.id })}>{topic.status === "已生成" ? "已生成" : "生成初稿"}</Button></div><p className="mt-3 text-sm leading-6 text-slate-300"><b>关联内容缺口：</b>{topic.contentGap}</p><p className="mt-2 text-sm leading-6 text-slate-300"><b>业务理由：</b>{topic.businessReason}</p></div>;
          })}</div>}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">文章列表与 GEO 内容质量评分</h2>
          {articles.length === 0 ? <EmptyState title="暂无文章初稿" description="请先从内容机会池生成初稿。初稿会展示文章标题、文章类型、关联客户问题、关联内容缺口、关联优化任务、目标平台、当前状态、内容质量分和是否允许发布。" /> : null}
          <div className="space-y-5">{articles.map(article => {
            const score = scoreForArticle(qualityScores, article.id);
            const qualityState = qualityLabel(score);
            const materials = (article.thirdPartyMaterials ?? {}) as Record<string, string>;
            const basis = (article.generationBasis ?? null) as ArticleGenerationBasisView | null;
            const basisRows = generationBasisRows(basis);
            const snippets = ((article.citableSnippets ?? []) as ArticleCitableSnippetView[]).filter(item => item.question && item.answer).slice(0, 5);
            const plan = platformPlan(article, basis, score);
            const record = articleRecordById.get(article.id);
            const allowPublish = Boolean(score && !score.blocked && score.totalScore >= 80 && hasRequiredBasis(basis));
            return <div key={article.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2"><StatusBadge status={article.status} /><span className={`rounded-full px-2 py-1 text-xs ${qualityState.className}`}>{qualityState.text}</span><span className={allowPublish ? "rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700" : "rounded-full bg-red-50 px-2 py-1 text-xs text-red-700"}>是否允许发布：{allowPublish ? "允许，需人工审核确认" : "不允许"}</span></div>
                  <h3 className="mt-3 text-lg font-semibold text-white">{article.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">文章类型：{article.articleType}｜当前状态：{article.status}｜内容质量分：{score ? `${score.totalScore} / 100` : "未评分"}</p>
                </div>
                <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={qualityCheck.isPending || !(article.status === "已生成" || article.status === "待质检")} onClick={() => qualityCheck.mutate({ articleId: article.id })}>质检评分</Button><Button variant="secondary" disabled={auditArticle.isPending || !score || Boolean(score.blocked) || score.totalScore < 80 || !(article.status === "待审核" || article.status === "质检通过")} onClick={() => auditArticle.mutate({ articleId: article.id, approved: true, note: "人工确认内容可发布" })}>审核通过</Button><Button variant="danger" disabled={auditArticle.isPending || !(article.status === "待审核" || article.status === "质检通过")} onClick={() => auditArticle.mutate({ articleId: article.id, approved: false, note: "人工审核退回" })}>审核退回</Button><Button disabled={publishArticle.isPending || article.status !== "审核通过"} onClick={() => publishArticle.mutate({ articleId: article.id })}>发布到内置页</Button></div>
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-cyan-200">关联客户问题</p><p className="mt-1 leading-6 text-slate-200">{basis?.customerQuestion || "来自优化任务的问题待补齐"}</p></div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-cyan-200">关联内容缺口</p><p className="mt-1 leading-6 text-slate-200">{basis?.contentGap || "待从诊断结果补齐"}</p></div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-cyan-200">关联优化任务</p><p className="mt-1 leading-6 text-slate-200">{basis?.optimizationTaskName ?? basis?.optimizationTask ?? "未匹配"}</p></div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-cyan-200">目标平台</p><p className="mt-1 leading-6 text-slate-200">{plan.first}；{plan.second}</p></div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-cyan-200">生成依据</p><p className="mt-1 leading-6 text-slate-200">{hasRequiredBasis(basis) ? "依据完整，可追溯" : "依据不足，需要补齐企业资料与诊断结论"}</p></div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-cyan-200">发布记录</p><p className="mt-1 leading-6 text-slate-200">{record ? `已发布：${publicUrl(record.publishUrl)}` : "尚未发布"}</p></div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-white">生成依据</h4><span className={hasRequiredBasis(basis) ? "rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700" : "rounded-full bg-red-50 px-2 py-1 text-xs text-red-700"}>{hasRequiredBasis(basis) ? "依据完整" : "依据不足，禁止发布"}</span></div>{basisRows.length === 0 ? <p className="mt-3 text-sm text-red-200">该文章缺少生成依据，请重新从真实优化任务生成。</p> : <dl className="mt-3 space-y-2">{basisRows.map(([label, value]) => <div key={label} className="rounded-xl bg-white/[0.04] p-3"><dt className="text-xs font-medium text-slate-400">{label}</dt><dd className="mt-1 text-sm leading-6 text-slate-200">{value}</dd></div>)}</dl>}</div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><h4 className="font-semibold text-white">引用友好片段</h4><p className="mt-1 text-sm text-slate-400">供 AI 搜索结果摘取的 3-5 段短答案。</p>{snippets.length === 0 ? <p className="mt-3 text-sm text-red-200">暂无引用片段，请重新生成文章。</p> : <div className="mt-3 space-y-2">{snippets.map((item, index) => <div key={index} className="rounded-xl bg-indigo-400/10 p-3"><p className="text-sm font-medium text-indigo-100">{item.question}</p><p className="mt-1 text-sm leading-6 text-indigo-50">{item.answer}</p></div>)}</div>}</div>
              </div>

              {score ? <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-medium text-white">GEO 内容质量评分：<span className={score.totalScore >= 80 && !score.blocked ? "text-emerald-300" : "text-red-300"}>{score.totalScore}</span> / 100</p><p className="mt-1 text-xs text-slate-400">{qualityState.text}</p></div><p className="text-xs text-slate-400">评分时间：{new Date(score.createdAt).toLocaleString()}</p></div><div className="mt-3 grid gap-2 md:grid-cols-3">{qualityDimensions.map(([key, label, max]) => <div key={String(key)} className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-xs text-slate-400">{label} / {max}</p><p className="mt-1 text-xl font-semibold text-white">{Number(score[key])}</p></div>)}</div><p className="mt-3 text-sm leading-6 text-slate-300"><b>质检摘要：</b>{score.reviewSummary}</p>{score.blockReasons.length > 0 ? <p className="mt-2 text-sm leading-6 text-red-200"><b>阻断原因：</b>{score.blockReasons.join("；")}</p> : null}</div> : <div className="mt-4"><EmptyState title="尚未质检" description="发布前必须先完成 GEO 内容质量评分，且总分不低于 80 分、无阻断风险。" /></div>}

              <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4">
                <h4 className="font-semibold text-cyan-100">平台优先级</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <p className="text-sm leading-6 text-slate-200"><b>第一优先级平台：</b>{plan.first}</p>
                  <p className="text-sm leading-6 text-slate-200"><b>第二优先级平台：</b>{plan.second}</p>
                  <p className="text-sm leading-6 text-slate-200"><b>不建议平台：</b>{plan.blocked}</p>
                  <p className="text-sm leading-6 text-slate-200"><b>推荐原因：</b>{plan.reason}</p>
                  <p className="text-sm leading-6 text-slate-200"><b>适合内容形式：</b>{plan.form}</p>
                  <p className="text-sm leading-6 text-slate-200"><b>复测指标：</b>{plan.metric}</p>
                </div>
                <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-50"><b>发布注意事项：</b>{plan.note}</p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]"><pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">{article.markdownContent}</pre><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><h4 className="font-semibold text-white">第三方平台素材</h4><p className="mt-1 text-sm leading-6 text-slate-400">除内置 GEO 内容页外，其余平台只支持复制和导出素材，不会自动登录或自动发布。</p><div className="mt-3 space-y-2">{Object.entries(materials).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-950/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-white">{thirdPartyPlatformLabels[key] ?? key}</p><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("已复制平台素材"))}>复制</Button><Button variant="secondary" onClick={() => downloadTextFile(`${article.id}-${key}.md`, value, "text/markdown;charset=utf-8")}>导出 Markdown</Button><Button variant="secondary" onClick={() => downloadTextFile(`${article.id}-${key}.html`, materialToHtml(`${article.title}-${key}`, value), "text/html;charset=utf-8")}>导出 HTML</Button></div></div><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-slate-400">{value}</p></div>)}</div></div></div>
            </div>;
          })}</div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">发布记录</h2>
          {records.length === 0 ? <EmptyState title="暂无发布记录" description="文章通过质检与人工审核后发布到内置 GEO 内容页，系统会在这里记录公开链接和待复测状态。" /> : <div className="space-y-3">{records.map(record => <div key={record.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="font-medium text-white">{record.publishChannel}</p><p className="mt-1 text-sm text-slate-300">质量分：{record.qualityScore}｜状态：{record.publishStatus}｜待复测：{record.needRetest ? "是" : "否"}</p><p className="mt-1 text-sm text-slate-400">{record.notes}</p></div><Button variant="secondary" onClick={() => navigator.clipboard.writeText(publicUrl(record.publishUrl)).then(() => toast.success("已复制公开链接"))}>复制公开链接</Button></div></div>)}</div>}
        </Card>
      </div> : null}
    </div>
  );
}

export function MonitoringPage() {
  const { projects, selectedProjectId, setProjectId, projectInput } = useSelectedProject();
  const recordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput);
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput);
  const records = recordsQuery.data ?? [];
  const articles = articlesQuery.data ?? [];
  const articleById = new Map(articles.map(article => [article.id, article]));
  const pendingRetestCount = records.filter(record => Boolean(record.needRetest)).length;
  const indexedCount = records.filter(record => record.publishStatus === "已发布").length;
  const unindexedCount = Math.max(records.length - indexedCount, 0);
  const aiMentionedCount = 0;
  const aiRecommendedCount = 0;
  const pendingOptimizationCount = records.filter(record => Boolean(record.needRetest)).length || records.length;
  const radarItems = [
    { title: "已发布内容", value: `${records.length} 篇`, detail: "来自真实发布记录，不把草稿计入监测样本。" },
    { title: "已收录内容", value: indexedCount > 0 ? `${indexedCount} 篇待确认` : "待人工检测", detail: "当前不自动抓取搜索引擎，需人工复测后确认收录事实。" },
    { title: "未收录内容", value: unindexedCount > 0 ? `${unindexedCount} 篇` : "待人工检测", detail: "未确认收录时默认进入标题、摘要和 FAQ 强化建议。" },
    { title: "AI 已提及内容", value: aiMentionedCount > 0 ? `${aiMentionedCount} 篇` : "待人工检测", detail: "复测 ChatGPT、DeepSeek、豆包、Kimi 等平台是否提及品牌。" },
    { title: "AI 已推荐内容", value: aiRecommendedCount > 0 ? `${aiRecommendedCount} 篇` : "待人工检测", detail: "区分 AI 仅提及与明确推荐，不承诺保证推荐。" },
    { title: "待优化内容", value: `${pendingOptimizationCount} 篇`, detail: "未收录、未提及或未推荐的内容进入下一轮优化。" },
  ];
  const optimizationActions = [
    "重写标题",
    "增强摘要",
    "增加 FAQ",
    "增加竞品对比段",
    "增加 AI 可引用片段",
    "生成知乎版",
    "生成公众号版",
    "重新生成增强版文章",
    "重新发布",
    "进入下一轮复测",
  ];
  const monitoringCards = records.map(record => {
    const article = articleById.get(record.articleId);
    const basis = (article?.generationBasis ?? null) as ArticleGenerationBasisView | null;
    const publishTime = record.publishedAt ? new Date(record.publishedAt).toLocaleString() : "待人工确认";
    const pending = Boolean(record.needRetest);
    return {
      id: record.id,
      title: article?.title ?? `文章 #${record.articleId}`,
      platform: record.publishChannel,
      link: publicUrl(record.publishUrl),
      publishTime,
      indexedStatus: record.publishStatus === "已发布" && !pending ? "待人工确认已收录" : "未收录 / 待人工检测",
      aiMentionStatus: "未提及 / 待人工检测",
      aiRecommendStatus: "未推荐 / 待人工检测",
      latestCheckTime: publishTime,
      relatedQuestion: basis?.customerQuestion || "关联问题待从生成依据补齐",
      suggestion: pending ? "进入下一轮复测，并优先增强标题、摘要、FAQ、竞品对比段和 AI 可引用片段。" : "完成人工收录和 AI 回答复测后更新客户交付报告。",
      showActions: true,
    };
  });
  return (
    <div>
      <PageHeader title="收录监测" description="AI 收录雷达用于记录已发布内容、已收录内容、未收录内容、AI 已提及内容、AI 已推荐内容和待优化内容。本轮不新增自动抓取或定时任务，只读取真实发布记录并保留人工复测工作台。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <div className="space-y-5">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-cyan-200">AI 收录雷达</p>
              <h2 className="mt-1 text-xl font-semibold text-white">收录、AI 是否提及品牌、AI 是否推荐品牌、AI 推荐与待优化状态</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">所有信号都来自真实发布内容、发布记录和人工复测，不做自动抓取、不伪造收录或 AI 推荐结果。</p>
            </div>
            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">人工复测</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {radarItems.map(item => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100">{item.value}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">内容监测卡</h2>
          {monitoringCards.length === 0 ? <div className="mt-4"><EmptyState title="暂无真实发布记录" description="请先在内容生产页完成质检、人工审核并发布到内置 GEO 内容页，再进入 AI 收录雷达复测。" /></div> : <div className="mt-4 space-y-4">
            {monitoringCards.map(item => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">发布平台：{item.platform}｜发布时间：{item.publishTime}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">发布链接：<a className="text-cyan-200 underline" href={item.link} target="_blank" rel="noreferrer">{item.link}</a></p>
                  </div>
                  <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-100">最近检测时间：{item.latestCheckTime}｜最近检测：待人工复测</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-cyan-200">收录状态</p><p className="mt-1 text-sm leading-6 text-slate-200">{item.indexedStatus}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-cyan-200">AI 提及状态</p><p className="mt-1 text-sm leading-6 text-slate-200">{item.aiMentionStatus}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-cyan-200">AI 推荐状态</p><p className="mt-1 text-sm leading-6 text-slate-200">{item.aiRecommendStatus}</p></div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><p className="text-xs text-cyan-200">关联问题</p><p className="mt-2 text-sm leading-6 text-slate-200">{item.relatedQuestion}</p></div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><p className="text-xs text-cyan-200">当前建议</p><p className="mt-2 text-sm leading-6 text-slate-200">{item.suggestion}</p></div>
                </div>
                {item.showActions ? <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4"><p className="text-sm font-medium text-amber-100">未收录 / 未提及 / 未推荐优化建议</p><div className="mt-3 flex flex-wrap gap-2">{optimizationActions.map(action => <span key={action} className="rounded-full border border-amber-300/20 bg-slate-950/50 px-3 py-1 text-xs text-amber-50">{action}</span>)}</div></div> : null}
              </div>
            ))}
          </div>}
        </Card>

        <Card>
          <p className="text-sm font-medium text-violet-200">真实风险</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">收录、AI 提及和 AI 推荐都不能保证发生；报告中只能记录已检测事实、公开证据和客户确认信息，不能承诺保证收录或保证排名，也不能保证推荐。</p>
        </Card>
      </div> : null}
    </div>
  );
}
