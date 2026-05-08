import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const files = {
  app: read("client/src/App.tsx"),
  geoPages: read("client/src/pages/GeoPages.tsx"),
  publicPage: read("client/src/pages/GeoPublicContent.tsx"),
  routers: read("server/routers.ts"),
  articleLogic: read("server/geoArticleLogic.ts"),
  schema: read("drizzle/schema.ts"),
};

const checks = [
  ["公开 GEO 内容页路由存在", files.app.includes('/geo/content/:projectId/:articleId')],
  ["公开内容页不含 example.com 占位链接", !/example\.com/i.test(files.publicPage)],
  ["文章生成后进入待质检", files.articleLogic.includes('status: "待质检"')],
  ["质检通过后进入待审核", files.routers.includes('status: quality.blocked ? "质检未通过" : "待审核"') || files.routers.includes('"待审核"')],
  ["审核通过后才可发布", files.articleLogic.includes('return status === "审核通过"')],
  ["发布后文章状态保持已发布", files.routers.includes('status: "已发布"')],
  ["发布后任务进入待复测", files.routers.includes('status: "retest"') && files.routers.includes('needRetest: 1')],
  ["发布记录包含质量分", files.schema.includes('qualityScore: int("qualityScore")')],
  ["第三方平台素材仅复制和导出", files.geoPages.includes('复制') && files.geoPages.includes('导出 Markdown') && files.geoPages.includes('导出 HTML')],
  ["无第三方平台自动登录/自动发布过程", !/(xhs|xiaohongshu|zhihu|wechat|baijiahao|toutiao).*login|login.*(xhs|xiaohongshu|zhihu|wechat|baijiahao|toutiao)|autoPublish|自动登录第三方|自动发布第三方/i.test(files.geoPages + files.routers + files.articleLogic)],
  ["质量评分低于 80 分阻断发布", files.articleLogic.includes('totalScore < 80') && files.articleLogic.includes('低于 80 分')],
  ["违禁内容检测包含假链接和绝对排名承诺", /example\.com/.test(files.articleLogic) && /排名第一|绝对排名|保证排名/.test(files.articleLogic)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

if (failed.length > 0) {
  console.error(`\nP1.1 acceptance check failed: ${failed.map(([name]) => name).join("；")}`);
  process.exit(1);
}

console.log("\nP1.1 acceptance check passed.");
