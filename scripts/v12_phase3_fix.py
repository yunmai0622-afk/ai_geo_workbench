from pathlib import Path

path = Path('/home/ubuntu/ai_geo_workbench/client/src/pages/GeoPages.tsx')
text = path.read_text()

start = text.index('export function ArticlesPage()')
end = text.index('\n\nexport function MonitoringPage()', start)
new_articles = r'''export function ArticlesPage() {
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
  const qualityLabel = (score: QualityScoreView | undefined) => {
    if (!score) return { text: "未评分：发布前必须先完成 GEO 内容质量评分", className: "bg-slate-100 text-slate-700" };
    if (score.blocked || score.totalScore < 80) return { text: "80 分以下：禁止发布", className: "bg-red-50 text-red-700" };
    if (score.totalScore >= 90) return { text: "90 分以上：优质 GEO 内容，可优先发布", className: "bg-emerald-50 text-emerald-700" };
    return { text: "80-89 分：建议优化后发布", className: "bg-amber-50 text-amber-700" };
  };
  const platformPlan = (article: NonNullable<typeof articlesQuery.data>[number], basis: ArticleGenerationBasisView | null, score: QualityScoreView | undefined) => {
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
      <PageHeader title={isPublishRoute ? "平台发布" : "内容生产"} description={isPublishRoute ? "平台发布页突出平台优先级、推荐原因、适合内容形式、发布注意事项和复测指标；第三方平台当前只生成素材，不自动登录发布。" : "内容生产页围绕内容机会池、文章列表、GEO 内容质量评分、生成依据和是否允许发布，确保每篇文章都来自真实诊断链路。"} />
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
}'''
text = text[:start] + new_articles + text[end:]

start = text.index('export function MonitoringPage()')
# MonitoringPage is last export in file; replace to end.
new_monitoring = r'''export function MonitoringPage() {
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
              <h2 className="mt-1 text-xl font-semibold text-white">收录、AI 提及、AI 推荐与待优化状态</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">所有信号都来自发布记录和人工复测，不做自动抓取、不伪造收录或 AI 推荐结果。</p>
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
                  <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-100">最近检测时间：{item.latestCheckTime}</span>
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
          <p className="mt-2 text-sm leading-6 text-slate-300">收录、AI 提及和 AI 推荐都不能保证发生；报告中只能记录已检测事实、公开证据和客户确认信息，不能承诺保证收录、保证排名或保证推荐。</p>
        </Card>
      </div> : null}
    </div>
  );
}
'''
text = text[:start] + new_monitoring
path.write_text(text)

# Add explicit V1.2 guide aliases without removing legacy internal titles.
guide_path = Path('/home/ubuntu/ai_geo_workbench/client/src/components/GeoStatusGuide.tsx')
guide = guide_path.read_text()
insert = r'''
  "总览指挥舱": {
    stage: "总览指挥舱",
    completion: 68,
    nextAction: "从当前项目与当前 GEO 阶段进入下一步动作，优先处理资产、诊断、内容或复测缺口。",
    why: "客户需要第一眼看到 GEO 增长闭环，而不是普通后台列表。",
    risk: "指标来自当前系统数据；缺少样本时必须提示待补齐，不能虚构成果。",
    ctaLabel: "补充企业资产",
    ctaPath: "/assets",
  },
  "企业资产": {
    stage: "企业资产",
    completion: 20,
    nextAction: "补充企业基础资料、产品服务资料、客户案例、竞品资料、合规规则和发布策略。",
    why: "企业资产是文章生成、质量评分和发布准入的事实来源。",
    risk: "资料不足时，系统不得编造案例、数据、价格和效果承诺。",
    ctaLabel: "开始补充企业资料",
    ctaPath: "/assets",
  },
  "AI 诊断": {
    stage: "AI 诊断",
    completion: 55,
    nextAction: "导入真实 AI 回答，完成语义分析和 GEO 评分，定位未提及、未推荐和竞品胜出原因。",
    why: "诊断结果决定内容机会池和优化任务，不能跳过真实问题与回答。",
    risk: "不得用模拟回答替代真实 AI 诊断样本。",
    ctaLabel: "查看内容策略",
    ctaPath: "/tasks",
  },
  "内容策略": {
    stage: "内容策略",
    completion: 72,
    nextAction: "把诊断缺口转化为可执行任务，并明确优先级、内容选题和复测指标。",
    why: "内容策略连接 AI 诊断与内容生产，避免随机写文章。",
    risk: "没有来源的任务会破坏诊断链路和客户交付可信度。",
    ctaLabel: "进入内容生产",
    ctaPath: "/articles",
  },
  "内容生产": {
    stage: "内容生产",
    completion: 82,
    nextAction: "从内容机会池生成文章，检查生成依据、GEO 内容质量评分和是否允许发布。",
    why: "客户需要确认每篇文章为什么写、解决哪个问题、是否达到发布标准。",
    risk: "低于 80 分、依据不足或存在合规阻断时禁止发布。",
    ctaLabel: "查看平台发布",
    ctaPath: "/publish",
  },
  "平台发布": {
    stage: "平台发布",
    completion: 86,
    nextAction: "确认第一优先级平台、第二优先级平台、不建议平台、发布注意事项和复测指标。",
    why: "平台选择影响内容形式和复测效果，不能把所有文章当普通发布列表处理。",
    risk: "第三方平台当前只生成素材，不自动登录发布。",
    ctaLabel: "进入收录监测",
    ctaPath: "/monitoring",
  },
  "报告中心": {
    stage: "报告中心",
    completion: 92,
    nextAction: "汇总诊断、内容、发布、收录监测、复测和客户交付报告。",
    why: "客户交付需要把 GEO 增长闭环串成可解释结果和下一步计划。",
    risk: "报告只能引用已确认事实，不承诺保证收录、排名或 AI 推荐。",
    ctaLabel: "查看收录监测",
    ctaPath: "/monitoring",
  },
'''
if '"总览指挥舱": {' not in guide:
    marker = 'export const pageGuides: Record<string, GeoStatusGuideProps> = {\n'
    guide = guide.replace(marker, marker + insert)
# Make the existing report route also match required label when title changes later.
guide_path.write_text(guide)
