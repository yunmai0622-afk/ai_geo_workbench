# Project TODO

- [x] 建立 8 张业务数据表：projects、questions、ai_responses、analysis_results、geo_scores、optimization_tasks、content_templates、reports
- [x] 实现项目管理页：新建、编辑、删除、列表展示企业项目
- [x] 项目字段支持企业名称、行业、官网、地区、产品介绍、目标客户、核心卖点、多个竞品名称、多个核心关键词
- [x] 实现问题库页：根据企业信息调用 AI 生成 50 个提问
- [x] 问题库支持编辑、删除、新增、启用/禁用问题
- [x] 问题类型限定为品牌认知、行业推荐、竞品对比、痛点解决、价格选型、高意向成交
- [x] 实现 AI 回答导入页：手动录入 AI 回答
- [x] 实现 AI 回答导入页：CSV 批量导入 AI 回答
- [x] AI 回答字段支持问题、AI 平台、原始回答、检测时间
- [x] AI 平台限定为 ChatGPT、DeepSeek、豆包、Kimi、通义、文心、Perplexity、其他
- [x] 实现 AI 分析页：调用 LLM 对每条 AI 回答做语义分析并输出结构化 JSON
- [x] AI 分析字段支持是否提到本企业、是否推荐本企业、是否提到竞品、被推荐竞品、本企业是否胜出、推荐理由、未推荐原因、错误认知、内容缺口、优化建议
- [x] AI 分析页在无 AI 回答数据时提示用户先导入数据，禁止生成分析
- [x] 实现 GEO 评分页：按 AI 可见度 25%、AI 推荐率 25%、竞品胜出率 20%、认知准确率 15%、内容资产完整度 15% 计算总分
- [x] GEO 评分页输出弱可见、初步可见、良好可见、强势推荐四档等级
- [x] 实现优化工作台页：根据分析结果自动生成优化任务
- [x] 优化任务类型覆盖官网首页、产品页、竞品对比页、FAQ、客户案例、行业文章、社媒内容
- [x] 优化任务字段包含名称、优先级、生成原因、执行建议、预计影响、状态
- [x] 实现内容模板与报告页：根据优化任务生成官网首页、FAQ、竞品对比、客户案例、行业选型文章五类模板
- [x] 内容模板支持一键复制和导出 Markdown
- [x] 生成老板版 GEO 诊断报告，包含一句话结论、总分、AI 提及推荐情况、竞品分析、核心问题、内容缺口、30 天优化动作
- [x] 使用全局侧边栏导航统一 7 个页面布局
- [x] 所有页面文案、标签、提示均为中文
- [x] 所有页面无数据状态显示友好引导提示
- [x] 严禁使用假数据伪装分析结果，分析数据必须来源于真实导入与计算
- [x] 编写 Vitest 测试覆盖核心业务逻辑
- [x] 完成类型检查与开发环境状态检查
- [x] 保存最终交付检查点

## 轻量 Harness 本轮变更

- [x] 为 projects 增加 status 字段，支持 created、questions_ready、responses_imported、analysis_done、score_done、tasks_ready、report_ready
- [x] 创建项目后状态为 created，并在生成问题、导入回答、完成分析、生成评分、生成任务、生成模板或报告后自动推进状态
- [x] 在 Dashboard 顶部增加当前进度卡片，展示当前状态、已完成步骤、下一步建议动作和下一步操作按钮
- [x] 为 optimization_tasks 补充 todo、doing、done、retest 四种状态流转
- [x] 为 optimization_tasks 补充 published_url、completed_at、need_retest 字段
- [x] 任务状态改为 done 时支持填写已发布链接并勾选是否需要复测
- [x] 为 content_templates 增加 optimization_task_id 绑定字段
- [x] 在优化任务详情中展示关联内容模板，并支持一键复制和导出 Markdown
- [x] 在内容模板页展示关联的优化任务名称
- [x] 保持无真实数据时阻断生成假结果
- [x] 保持现有 10 个 Vitest 用例通过，并按需补充状态流转核心测试
- [x] 完成类型检查、环境检查并保存交付检查点
- [x] 核查 GeoPages.tsx 顶部 React hooks 与事件类型导入，确认轻量 Harness 页面通过类型检查
