import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

/** Manus 改版后企业建档相关 UI 分布在页面与 section 组件中 */
const ENTERPRISE_PROFILE_UI_FILES = [
  "client/src/pages/AssetCenter.tsx",
  "client/src/components/enterpriseProfile/FiveMinuteBasicOnboardingSection.tsx",
  "client/src/components/enterpriseProfile/ProfileUploadAssistSection.tsx",
  "client/src/components/enterpriseProfile/EnterprisePublishEnvironmentSection.tsx",
  "client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx",
  "client/src/components/enterpriseProfile/ProfileAiUnderstandingPreview.tsx",
  "client/src/components/enterpriseProfile/ProfilePublishEnvLightHint.tsx",
] as const;

export function readEnterpriseProfileUi(): string {
  return ENTERPRISE_PROFILE_UI_FILES.map(rel => readFileSync(resolve(root, rel), "utf-8")).join("\n");
}
