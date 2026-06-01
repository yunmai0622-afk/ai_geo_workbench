import { lazy } from "react";

export const WeeklyContentPage = lazy(() => import("@/pages/WeeklyContentPage"));

export const DeliveryReportsFlowPage = lazy(() =>
  import("@/pages/DeliveryReportsCenterPage").then(module => ({
    default: module.DeliveryReportsCenterPage,
  })),
);

export const AiDiagnosisFlowPage = lazy(() =>
  import("@/pages/V12FlowPages").then(module => ({
    default: module.AiDiagnosisFlowPage,
  })),
);

export const ContentPublishingFlowPage = lazy(() =>
  import("@/pages/V12FlowPages").then(module => ({
    default: module.ContentPublishingFlowPage,
  })),
);

export const InclusionMonitoringFlowPage = lazy(() =>
  import("@/pages/V12FlowPages").then(module => ({
    default: module.InclusionMonitoringFlowPage,
  })),
);
