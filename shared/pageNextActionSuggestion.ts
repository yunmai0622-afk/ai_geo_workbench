import { resolvePageShellRoute } from "./globalNavVisibility";
import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";
import { WORKSPACE_STAGES } from "./workspaceStateMachine";

export type PageNextActionSuggestion = {
  ctaLabel: string;
  reason: string;
  nextStageName: string;
  /** 不含 projectId，由前端 buildProjectUrl 拼接 */
  ctaPath: string;
};

const bindPublishStage = WORKSPACE_STAGES.find(s => s.id === "bind_publish_env")!;

export function resolvePageNextActionSuggestion(
  pathname: string,
  metrics: WorkspaceSummaryMetrics,
): PageNextActionSuggestion | null {
  const route = resolvePageShellRoute(pathname);

  switch (route) {
    case "enterprise_profile": {
      const pct = Math.round(metrics.profileCompletionPercent);
      if (!metrics.p0ProfileComplete) {
        return {
          ctaLabel: "继续完成品牌建档",
          reason: `建档完成度约 ${pct}%，补齐企业名称、行业、产品与客群等必填项后再做 AI 实测。`,
          nextStageName: "待诊断",
          ctaPath: "/enterprise-profile",
        };
      }
      return {
        ctaLabel: "开始 AI 实测诊断",
        reason: "P0 建档已满足门槛，建议进入 AI 实测，确认品牌在主流 AI 平台的提及与推荐情况。",
        nextStageName: "待诊断",
        ctaPath: "/ai-diagnosis",
      };
    }
    case "ai_diagnosis":
    case "questions": {
      if (!metrics.hasCompletedT0Baseline && !metrics.hasAnalysis && !metrics.hasGeoScore) {
        return {
          ctaLabel: "开始 AI 现状检测",
          reason: "尚未完成基线诊断，需先导入或运行客户问题实测，才能识别内容缺口。",
          nextStageName: "内容生产",
          ctaPath: "/ai-diagnosis",
        };
      }
      const gapCount = metrics.t0ContentGapSuggestions?.items.length ?? 0;
      const scoreText =
        metrics.geoScore != null ? `当前 GEO 评分 ${Math.round(metrics.geoScore)} 分。` : "";
      if (gapCount > 0) {
        const headline = metrics.t0ContentGapSuggestions?.headline?.trim();
        return {
          ctaLabel: "根据诊断缺口生成内容",
          reason: headline
            ? `${headline}（共 ${gapCount} 条缺口建议）${scoreText}`
            : `已识别 ${gapCount} 项内容缺口，建议优先生成竞品对比、能力说明或 FAQ 类资产。${scoreText}`,
          nextStageName: "内容生产",
          ctaPath: "/weekly",
        };
      }
      return {
        ctaLabel: metrics.articleCount > 0 ? "查看内容资产" : "生成平台化内容资产",
        reason: metrics.hasGeoScore
          ? `诊断与评分已完成。${scoreText}`.trim()
          : "诊断结果已生成，建议围绕高优先级问题产出可发布内容。",
        nextStageName: "内容生产",
        ctaPath: metrics.articleCount > 0 ? "/weekly" : "/weekly",
      };
    }
    case "content_assets": {
      if (metrics.articleCount <= 0) {
        return {
          ctaLabel: "生成首批内容资产",
          reason: "尚无平台化内容，请基于诊断结论与优化任务生成至少 1 篇可质检文章。",
          nextStageName: "待发布",
          ctaPath: "/weekly",
        };
      }
      const publishableHint =
        metrics.publishRecordCount > 0 || metrics.publishTaskCount > 0
          ? `已有 ${metrics.articleCount} 篇内容资产，${metrics.publishRecordCount} 次发布记录。`
          : `当前有 ${metrics.articleCount} 篇内容资产，可将质检通过的内容加入发布队列。`;
      return {
        ctaLabel: "进入平台适配发布",
        reason: publishableHint,
        nextStageName: "待发布",
        ctaPath: "/content-publishing",
      };
    }
    case "content_publishing": {
      if (metrics.boundPublishAccountCount <= 0) {
        return {
          ctaLabel: bindPublishStage.ctaLabel,
          reason: bindPublishStage.blockerHint,
          nextStageName: "待发布",
          ctaPath: "/content-publishing",
        };
      }
      if (metrics.publishRecordCount <= 0 && metrics.publishTaskCount <= 0) {
        return {
          ctaLabel: "将内容加入发布队列",
          reason: `已绑定 ${metrics.boundPublishAccountCount} 个发布账号，请从内容资产中选择可发布条目并创建发布任务。`,
          nextStageName: "待监测",
          ctaPath: "/content-publishing",
        };
      }
      if (metrics.waitingPublicLinkCount > 0) {
        return {
          ctaLabel: "回填公开链接",
          reason: `有 ${metrics.waitingPublicLinkCount} 条发布记录待补充公开链接，完成后才能安排收录复测。`,
          nextStageName: "待监测",
          ctaPath: "/content-publishing",
        };
      }
      return {
        ctaLabel: "查看收录监测",
        reason: "发布动作已建立，建议进入收录监测查看 AI 提及与推荐变化。",
        nextStageName: "待监测",
        ctaPath: "/inclusion-monitoring",
      };
    }
    case "inclusion_monitoring": {
      return {
        ctaLabel: metrics.retestPendingCount > 0 ? "处理待复测项" : "查看交付报告",
        reason:
          metrics.retestPendingCount > 0
            ? `复测队列有 ${metrics.retestPendingCount} 条待处理，请按发布后复测节奏完成复测。`
            : "收录与实测数据已积累，可整理客户交付报告。",
        nextStageName: metrics.reportCount > 0 ? "报告已生成" : "待出报告",
        ctaPath: metrics.reportCount > 0 ? "/delivery-reports" : "/inclusion-monitoring",
      };
    }
    case "delivery_reports": {
      return {
        ctaLabel: "返回项目工作台",
        reason:
          metrics.reportCount > 0
            ? "交付报告已生成，可在工作台查看本轮指标与下一轮优化入口。"
            : "汇总诊断、内容、发布与监测数据后，生成本轮客户交付报告。",
        nextStageName: "持续优化",
        ctaPath: "/workspace",
      };
    }
    case "workspace":
      return null;
    default:
      return null;
  }
}

