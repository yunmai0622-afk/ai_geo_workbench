/** GEO 本地发布 Agent HTTP 基址（浏览器与本机 Agent 通信） */
export const LOCAL_AGENT_BASE_URL = "http://127.0.0.1:39888";

export const LOCAL_AGENT_HEALTH_PATH = "/health";

/** 浏览器直连本机 Agent 健康检查（生产环境必须直连用户机器，不能走远端服务器代理） */
export const LOCAL_AGENT_DIRECT_HEALTH_URL = `${LOCAL_AGENT_BASE_URL}${LOCAL_AGENT_HEALTH_PATH}`;

/**
 * 同源代理健康检查：仅当 Web 与 Agent 同机部署时有效（如本机 dev server）。
 * 远端 Manus 部署时该代理探测的是服务器 127.0.0.1，无法代表用户本机 Agent。
 */
export const LOCAL_AGENT_BROWSER_HEALTH_URL = "/api/local-agent/health";
