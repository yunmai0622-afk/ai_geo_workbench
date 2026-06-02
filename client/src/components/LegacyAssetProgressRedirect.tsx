import { buildProjectUrl, getActiveProjectId, getSearchFromLocation } from "@/lib/activeProject";
import { Redirect, useLocation } from "wouter";

/** 旧「资产进展」路径统一重定向到项目工作台或企业项目列表 */
export default function LegacyAssetProgressRedirect() {
  const [location] = useLocation();
  const search = getSearchFromLocation(location);
  const projectId = getActiveProjectId({ search });
  if (projectId) {
    return <Redirect to={buildProjectUrl("/workspace", projectId)} />;
  }
  return <Redirect to="/clients" />;
}
