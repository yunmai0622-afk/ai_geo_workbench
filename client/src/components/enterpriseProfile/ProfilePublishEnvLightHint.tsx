import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand } from "@/lib/geoP0Visual";
import { useLocation } from "wouter";

type Props = {
  projectId: number;
  configured: boolean;
};

/** P1-A：首屏仅轻提示；完整绑定在折叠区，避免与 5 分钟建档抢第一屏 */
export function ProfilePublishEnvLightHint({ projectId, configured }: Props) {
  const [, setLocation] = useLocation();

  if (configured) return null;

  return (
    <P0Card testId="profile-publish-env-hint">
      <p className="text-sm text-gray-600">
        发布环境未配置不影响建档。完成建档后，可前往“平台适配发布”绑定账号。
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`mt-3 ${geoP0Brand.primaryOutline}`}
        data-testid="profile-publish-env-hint-cta"
        onClick={() => setLocation(buildProjectUrl("/content-publishing", projectId))}
      >
        稍后去平台适配发布
      </Button>
    </P0Card>
  );
}
