import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const questionTypes = ["品牌认知", "行业推荐", "竞品对比", "痛点解决", "价格选型", "高意向成交"] as const;
const platforms = ["ChatGPT", "DeepSeek", "豆包", "Kimi", "通义", "文心", "Perplexity", "其他"] as const;
const statuses = ["待处理", "进行中", "已完成"] as const;

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

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-blue-700">企业 GEO 管理平台</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
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

function ProjectSelector({ selectedProjectId, setProjectId, projects }: { selectedProjectId?: number; setProjectId: (id: number | undefined) => void; projects: Array<{ id: number; enterpriseName: string; industry: string }> }) {
  if (projects.length === 0) {
    return <EmptyState title="请先创建企业项目" description="后续问题生成、回答导入、语义分析和 GEO 评分都必须基于真实企业项目进行。" />;
  }
  return (
    <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <Select label="当前企业项目" value={selectedProjectId ? String(selectedProjectId) : "none"} onChange={value => setProjectId(value === "none" ? undefined : Number(value))}>
        <option value="none">请选择项目</option>
        {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}｜{project.industry}</option>)}
      </Select>
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
  const createQuestion = trpc.geo.questions.create.useMutation({ onSuccess: async () => { await utils.geo.questions.list.invalidate(); toast.success("问题已保存"); } });
  const updateQuestion = trpc.geo.questions.update.useMutation({ onSuccess: async () => { await utils.geo.questions.list.invalidate(); toast.success("问题已更新"); } });
  const deleteQuestion = trpc.geo.questions.delete.useMutation({ onSuccess: async () => { await utils.geo.questions.list.invalidate(); toast.success("问题已删除"); } });
  const toggleQuestion = trpc.geo.questions.toggle.useMutation({ onSuccess: async () => utils.geo.questions.list.invalidate() });
  const generateQuestions = trpc.geo.questions.generate.useMutation({ onSuccess: async result => { await utils.geo.questions.list.invalidate(); toast.success(`已生成 ${result.count} 个问题`); }, onError: error => toast.error(error.message) });
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<typeof questionTypes[number]>("品牌认知");
  const [editingId, setEditingId] = useState<number | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return toast.error("请先选择项目");
    const payload = { projectId: selectedProjectId, questionText, questionType, enabled: true };
    if (editingId) updateQuestion.mutate({ id: editingId, ...payload });
    else createQuestion.mutate(payload);
    setQuestionText("");
    setEditingId(null);
  };

  return (
    <div>
      <PageHeader title="问题库" description="根据企业信息调用 AI 生成 50 个提问，也支持手动新增、编辑、删除、启用或禁用问题。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">问题操作</h2>
          <div className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">AI 生成结果直接来自当前企业信息，不会用假问题补齐。如生成失败，请检查项目信息后重试。</div>
          <Button disabled={generateQuestions.isPending} onClick={() => generateQuestions.mutate({ projectId: selectedProjectId })}>{generateQuestions.isPending ? "正在生成..." : "AI 生成 50 个问题"}</Button>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <TextArea label="问题内容" value={questionText} onChange={setQuestionText} />
            <Select label="问题类型" value={questionType} onChange={value => setQuestionType(value as typeof questionTypes[number])}>{questionTypes.map(type => <option key={type} value={type}>{type}</option>)}</Select>
            <Button type="submit">{editingId ? "保存问题" : "新增问题"}</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">问题列表</h2>
          {(questionsQuery.data ?? []).length === 0 ? <EmptyState title="暂无问题" description="请先点击 AI 生成 50 个问题，或手动新增问题。" /> : null}
          <div className="space-y-3">
            {(questionsQuery.data ?? []).map(question => (
              <div key={question.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{question.questionType}</span>
                    <p className="mt-2 text-sm font-medium text-slate-950">{question.questionText}</p>
                    <p className="mt-1 text-xs text-slate-500">状态：{question.enabled ? "启用" : "禁用"}</p>
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
  const createResponse = trpc.geo.aiResponses.create.useMutation({ onSuccess: async () => { await utils.geo.aiResponses.list.invalidate(); toast.success("AI 回答已录入"); } });
  const importRows = trpc.geo.aiResponses.importCsvRows.useMutation({ onSuccess: async result => { await utils.geo.aiResponses.list.invalidate(); toast.success(`已导入 ${result.count} 条 AI 回答`); }, onError: error => toast.error(error.message) });
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
      <PageHeader title="AI 回答导入" description="手动录入或通过 CSV 批量导入来自 ChatGPT、DeepSeek、豆包、Kimi、通义、文心、Perplexity 等平台的真实回答。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
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
  const runAnalysis = trpc.geo.analysis.run.useMutation({ onSuccess: async result => { await utils.geo.analysis.list.invalidate(); toast.success(`已完成 ${result.count} 条 AI 回答分析`); }, onError: error => toast.error(error.message) });
  return (
    <div>
      <PageHeader title="AI 语义分析" description="调用 LLM 对每条 AI 原始回答进行语义分析，输出结构化 JSON。分析必须基于真实导入回答。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <Card>
        {(responsesQuery.data ?? []).length === 0 ? <EmptyState title="暂无可分析的 AI 回答" description="请先到 AI 回答导入页录入或导入真实回答，再运行语义分析。" /> : <div className="mb-5 flex items-center justify-between"><p className="text-sm text-slate-600">当前可分析回答：{responsesQuery.data?.length ?? 0} 条</p><Button disabled={runAnalysis.isPending} onClick={() => runAnalysis.mutate({ projectId: selectedProjectId })}>{runAnalysis.isPending ? "正在分析..." : "运行 AI 语义分析"}</Button></div>}
        {(analysisQuery.data ?? []).length === 0 ? <EmptyState title="暂无分析结果" description="运行语义分析后，系统会展示是否提到本企业、是否推荐、竞品情况、错误认知、内容缺口与优化建议。" /> : null}
        <div className="space-y-4">
          {(analysisQuery.data ?? []).map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-4"><div className="grid gap-3 text-sm md:grid-cols-2"><p><b>是否提到本企业：</b>{item.mentionsEnterprise ? "是" : "否"}</p><p><b>是否推荐本企业：</b>{item.recommendsEnterprise ? "是" : "否"}</p><p><b>是否提到竞品：</b>{item.mentionsCompetitors ? "是" : "否"}</p><p><b>本企业是否胜出：</b>{item.enterpriseWins ? "是" : "否"}</p><p><b>被推荐竞品：</b>{joinList(item.recommendedCompetitors) || "无"}</p><p><b>是否存在错误认知：</b>{item.hasMisconception ? "是" : "否"}</p></div><div className="mt-3 space-y-2 text-sm text-slate-700"><p><b>推荐理由：</b>{item.recommendationReason || "无"}</p><p><b>未推荐原因：</b>{item.notRecommendedReason || "无"}</p><p><b>内容缺口：</b>{item.contentGap || "无"}</p><p><b>优化建议：</b>{item.optimizationSuggestion || "无"}</p></div><pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(item.rawJson, null, 2)}</pre></div>)}
        </div>
      </Card> : null}
    </div>
  );
}

export function ScoresPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setProjectId, projectInput } = useSelectedProject();
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput);
  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput);
  const calculate = trpc.geo.scores.calculate.useMutation({ onSuccess: async () => { await utils.geo.scores.latest.invalidate(); toast.success("GEO 评分已计算"); }, onError: error => toast.error(error.message) });
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
  const generateTasks = trpc.geo.tasks.generate.useMutation({ onSuccess: async result => { await utils.geo.tasks.list.invalidate(); toast.success(`已生成 ${result.count} 条优化任务`); }, onError: error => toast.error(error.message) });
  const updateStatus = trpc.geo.tasks.updateStatus.useMutation({ onSuccess: async () => utils.geo.tasks.list.invalidate() });
  return (
    <div>
      <PageHeader title="优化工作台" description="根据语义分析结果生成官网首页、产品页、竞品对比页、FAQ、客户案例、行业文章和社媒内容任务。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <Card>
        {(analysisQuery.data ?? []).length === 0 ? <EmptyState title="暂无分析结果" description="请先运行 AI 语义分析。优化任务必须来源于真实分析结果，不会凭空生成。" /> : <div className="mb-5 flex items-center justify-between"><p className="text-sm text-slate-600">当前分析样本：{analysisQuery.data?.length ?? 0} 条</p><Button disabled={generateTasks.isPending} onClick={() => generateTasks.mutate({ projectId: selectedProjectId })}>{generateTasks.isPending ? "正在生成..." : "生成优化任务"}</Button></div>}
        {(tasksQuery.data ?? []).length === 0 ? <EmptyState title="暂无优化任务" description="生成任务后，可在此查看任务名称、优先级、生成原因、执行建议、预计影响和状态。" /> : null}
        <div className="space-y-4">{(tasksQuery.data ?? []).map(task => <div key={task.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{task.taskType}｜{task.priority}</span><h3 className="mt-2 font-semibold">{task.taskName}</h3><p className="mt-2 text-sm text-slate-600"><b>生成原因：</b>{task.generationReason}</p><p className="mt-2 text-sm text-slate-600"><b>执行建议：</b>{task.executionSuggestion}</p><p className="mt-2 text-sm text-slate-600"><b>预计影响：</b>{task.expectedImpact}</p></div><select value={task.status} onChange={event => updateStatus.mutate({ id: task.id, status: event.target.value as typeof statuses[number] })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{statuses.map(status => <option key={status} value={status}>{status}</option>)}</select></div></div>)}</div>
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
  const generateTemplates = trpc.geo.templates.generate.useMutation({ onSuccess: async result => { await utils.geo.templates.list.invalidate(); toast.success(`已生成 ${result.count} 个内容模板`); }, onError: error => toast.error(error.message) });
  const generateReport = trpc.geo.reports.generate.useMutation({ onSuccess: async () => { await utils.geo.reports.latest.invalidate(); toast.success("诊断报告已生成"); }, onError: error => toast.error(error.message) });
  return (
    <div>
      <PageHeader title="内容模板与报告" description="根据优化任务生成内容模板，并导出老板版 GEO 诊断报告 Markdown。" />
      <ProjectSelector selectedProjectId={selectedProjectId} setProjectId={setProjectId} projects={projects} />
      {selectedProjectId ? <div className="space-y-5">
        <Card>
          {(tasksQuery.data ?? []).length === 0 ? <EmptyState title="暂无优化任务" description="请先在优化工作台生成任务，再生成内容模板和诊断报告。" /> : <div className="flex flex-wrap gap-3"><Button disabled={generateTemplates.isPending} onClick={() => generateTemplates.mutate({ projectId: selectedProjectId })}>{generateTemplates.isPending ? "正在生成模板..." : "生成内容模板"}</Button><Button disabled={generateReport.isPending} onClick={() => generateReport.mutate({ projectId: selectedProjectId })}>{generateReport.isPending ? "正在生成报告..." : "生成老板版 GEO 诊断报告"}</Button></div>}
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">内容模板</h2>
          {(templatesQuery.data ?? []).length === 0 ? <EmptyState title="暂无内容模板" description="模板只会根据已生成的优化任务创建，不会展示英文占位符或假模板。" /> : null}
          <div className="space-y-4">{(templatesQuery.data ?? []).map(template => <div key={template.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{template.templateType}</span><h3 className="mt-2 font-semibold">{template.title}</h3></div><div className="flex gap-2"><Button variant="secondary" onClick={() => navigator.clipboard.writeText(template.markdownContent).then(() => toast.success("已复制模板"))}>一键复制</Button><Button variant="secondary" onClick={() => downloadMarkdown(`${template.title}.md`, template.markdownContent)}>导出 Markdown</Button></div></div><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{template.markdownContent}</pre></div>)}</div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">老板版 GEO 诊断报告</h2>
          {!reportQuery.data ? <EmptyState title="暂无诊断报告" description="请先完成分析、评分和任务生成，再生成报告。报告内容会来自真实导入与计算结果。" /> : <div><div className="mb-3 flex gap-2"><Button variant="secondary" onClick={() => navigator.clipboard.writeText(reportQuery.data?.markdownContent ?? "").then(() => toast.success("已复制报告"))}>一键复制</Button><Button variant="secondary" onClick={() => downloadMarkdown(`${(reportQuery.data?.oneSentenceConclusion ?? "GEO诊断报告").slice(0, 20)}.md`, reportQuery.data?.markdownContent ?? "")}>导出 Markdown</Button></div><pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm text-slate-100">{reportQuery.data?.markdownContent ?? ""}</pre></div>}
        </Card>
      </div> : null}
    </div>
  );
}
