export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/** GEO 文章质检「内容质量总分」及格线；合规通过且总分不低于此值视为「质检通过，可发布」。 */
export const GEO_ARTICLE_MIN_PASS_SCORE = 60;

/** 数据清理后已删除的演示项目 ID，客户端不得再作为 activeProjectId 使用 */
export const LEGACY_ORPHAN_PROJECT_ID = 30001;
