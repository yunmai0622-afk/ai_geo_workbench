import { P0Card } from "@/components/geo/P0UiPrimitives";
import { geoP0Surfaces } from "@/lib/geoP0Visual";
import { LOCAL_AGENT_PUBLISH_STEPS } from "@/lib/publishCenterDisplay";
import { buildProjectUrl } from "@/lib/activeProject";

type Props = {
  projectId?: number;
};

export function LocalAgentPublishStepsPanel({ projectId }: Props) {
  return (
    <P0Card testId="publish-center-steps-panel" className="lg:sticky lg:top-20">
      <p className={geoP0Surfaces.sectionTitle}>本地发布步骤</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
        {LOCAL_AGENT_PUBLISH_STEPS.map(step => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {projectId ? (
        <p className="mt-4 text-xs text-gray-500">
          完成回填后，可前往
          <button
            type="button"
            className="mx-1 text-blue-600 hover:underline"
            onClick={() => {
              window.location.href = buildProjectUrl("/inclusion-monitoring", projectId);
            }}
          >
            收录监测
          </button>
          查看结果。
        </p>
      ) : null}
    </P0Card>
  );
}
