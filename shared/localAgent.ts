/** GEO 本地发布 Agent HTTP 基址（服务端与绑定类操作直连；健康检查走同源代理） */
export const LOCAL_AGENT_BASE_URL = "http://127.0.0.1:39888";

export const LOCAL_AGENT_HEALTH_PATH = "/health";

/** 浏览器健康检查：经 Web 服务代理，避免未启动 Agent 时在 Console 报连接拒绝 */
export const LOCAL_AGENT_BROWSER_HEALTH_URL = "/api/local-agent/health";
