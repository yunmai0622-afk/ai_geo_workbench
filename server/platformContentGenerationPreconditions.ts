import {
  PLATFORM_CONTENT_PARAMS_MISSING_MESSAGE,
} from "@shared/platformContentGenerationErrors";
import {
  evaluateEnterpriseProfileReadiness,
  formatEnterpriseProfileMissingError,
} from "@shared/platformContentProfileReadiness";
import type { PlatformContentStrategyInput } from "@shared/platformContentRules";
import { validatePlatformContentStrategy } from "@shared/platformContentRules";
import type { P11ProjectLike, P12AssetLibraryContext } from "./geoArticleLogic";

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
  const readiness = evaluateEnterpriseProfileReadiness({
    project: {
      enterpriseName: project.enterpriseName,
      productIntro: project.productIntro,
      targetCustomers: project.targetCustomers,
      industry: project.industry,
    },
    profile: assetLibrary?.profile ?? null,
    platformStrategy,
  });
  if (!readiness.ready) {
    throw new Error(formatEnterpriseProfileMissingError(readiness.missingLabels));
  }
}
