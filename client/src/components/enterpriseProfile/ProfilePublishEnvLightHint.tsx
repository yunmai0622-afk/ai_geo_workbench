import { P0Card } from "@/components/geo/P0UiPrimitives";
import { Button } from "@/components/ui/button";
import { buildProjectUrl } from "@/lib/activeProject";
import { geoP0Brand, geoP0Surfaces } from "@/lib/geoP0Visual";
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
      <p className="text-sm text-slate-700">
        发布环境未配置不影响建档。完成建档后，可前往发布中心绑定。
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`mt-3 ${geoP0Brand.primaryOutline}`}
        data-testid="profile-publish-env-hint-cta"
        onClick={() => setLocation(buildProjectUrl("/content-publishing", projectId))}
      >
        稍后去发布中心
      </Button>
      <p className={`mt-2 ${geoP0Surfaces.muted}`}>需要在本页配置发布客户端与账号时，可展开下方「发布环境配置」。</p>
    </P0Card>
  );
}
