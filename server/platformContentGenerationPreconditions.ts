import {
  PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE,
  PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE,
} from "@shared/platformContentGenerationErrors";
import type { PlatformContentStrategyInput } from "@shared/platformContentRules";
import { validatePlatformContentStrategy } from "@shared/platformContentRules";
import type { P11ProjectLike, P12AssetLibraryContext } from "./geoArticleLogic";
import { resolveEnterpriseProfileForContent } from "./geoArticleLogic";

export function assertPlatformContentStrategyParams(
  strategy: PlatformContentStrategyInput | undefined,
): void {
  if (!strategy) return;
  const err = validatePlatformContentStrategy(strategy);
  if (err) throw new Error(PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE);
}

export function assertEnterpriseProfileForPlatformGeneration(
  project: P11ProjectLike,
  assetLibrary: P12AssetLibraryContext | null | undefined,
  platformStrategy?: PlatformContentStrategyInput,
): void {
  const resolved = resolveEnterpriseProfileForContent(assetLibrary?.profile ?? null);
  const brandName = (project.enterpriseName?.trim() || resolved.brandName.trim());
  const productIntro = (project.productIntro?.trim() || resolved.productDesc.trim());
  const targetCustomers = (project.targetCustomers?.trim() || resolved.targetCustomer.trim());
  const targetQuestion = platformStrategy?.targetQuestion?.trim() ?? "";

  if (!brandName || !productIntro || !targetCustomers) {
    throw new Error(PLATFORM_CONTENT_PROFILE_INSUFFICIENT_MESSAGE);
  }
  if (platformStrategy && !targetQuestion) {
    throw new Error(PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE);
  }
}
