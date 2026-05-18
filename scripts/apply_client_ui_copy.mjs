// One-off: replace user-facing copy in client tsx (not Map.tsx). Preserves status literals via STATUS_REVERT.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REPLACEMENTS = [
  ["GEO内容质量审查与反同质化检查", "文章质量检查"],
  ["GEO 内容质量审查与反同质化检查", "文章质量检查"],
  ["分数代表推演语境下企业对AI可见度与内容资产的匹配程度", "分数越高，你的内容越容易被AI推荐给潜在客户"],
  ["面向客户的本轮交付摘要；细节可按区域展开查阅。", "本轮内容诊断与生成的完整成果"],
  ["面向客户的本轮交付摘要；细节可按区域展开查阅", "本轮内容诊断与生成的完整成果"],
  ["自有内容站 / 企业官网 GEO 页面", "官网/自有平台"],
  ["推演：是否易提及本企业", "客户搜这个问题时，AI会提到你吗"],
  ["推演：是否易推荐本企业", "AI会把你推荐给客户吗"],
  ["可见度与内容缺口分析", "内容缺口"],
  ["可见度与缺口推演", "内容缺口"],
  ["AI GEO 增长工作台", "内容增长系统"],
  ["AI GEO增长工作台", "内容增长系统"],
  ["企业 GEO 内容增长工作台", "企业内容增长系统"],
  ["AI 可见度诊断", "内容诊断"],
  ["GEO 可见度诊断", "内容诊断"],
  ["GEO可见度诊断", "内容诊断"],
  ["GEO 可见度评分", "内容覆盖评分"],
  ["GEO可见度评分", "内容覆盖评分"],
  ["综合可见度评分", "内容覆盖评分"],
  ["本周 GEO 内容计划", "本周内容计划"],
  ["本周GEO内容计划", "本周内容计划"],
  ["GEO 内容增长交付报告", "本轮内容效果报告"],
  ["GEO内容增长交付报告", "本轮内容效果报告"],
  ["公开 GEO 内容页", "公开内容页"],
  ["公开 GEO 内容", "公开内容"],
  ["公开GEO内容", "公开内容"],
  ["重新运行AI诊断", "重新诊断"],
  ["重新运行 AI 诊断", "重新诊断"],
  ["生成并质检中…", "生成中…"],
  ["生成并质检中", "生成中"],
  ["GEO 内容质量审查完成", "文章质量检查完成"],
  ["GEO 内容质量审查", "文章质量检查"],
  ["GEO 内容质量审查失败", "文章质量检查失败"],
  ["GEO 内容已生成并完成质检", "内容已生成并完成质量检查"],
  ["GEO 内容已生成，质检结果为需人工审核", "内容已生成，质量检查结果为需人工审核"],
  ["GEO 内容已生成并完成质检（", "内容已生成并完成质量检查（"],
  ["GEO 内容已生成", "内容已生成"],
  ["生成 GEO 内容失败", "生成内容失败"],
  ["生成 1 篇 GEO 内容", "生成 1 篇文章"],
  ["生成 GEO 内容", "生成内容"],
  ["4. 生成 GEO 内容", "4. 生成内容"],
  ["请先生成 1 篇 GEO 内容", "请先生成 1 篇文章"],
  ["仅可选择已通过 GEO 质检的文章", "仅可选择已通过质量检查的文章"],
  ["完成 GEO 质检", "完成质量检查"],
  ["自动 GEO 质检", "自动质量检查"],
  ["执行 GEO 生成与质检", "执行生成与质量检查"],
  ["GEO 生成与质检", "生成与质量检查"],
  ["GEO 质检与轻量反同质化检查", "质量检查与轻量差异度检查"],
  ["GEO 质检与反同质化检查", "质量检查与差异度检查"],
  ["GEO 质检", "质量检查"],
  ["GEO质检", "质量检查"],
  ["反同质化检查结果", "与历史文章差异度"],
  ["反同质化检查", "差异度检查"],
  ["反同质化", "差异度"],
  ["轻量反同质化检查", "轻量差异度检查"],
  ["GEO 推演", "内容分析"],
  ["GEO推演", "内容分析"],
  ["做 GEO 推演", "做内容分析"],
  ["结合竞品与行业常识做 GEO 推演", "结合竞品与行业常识做内容分析"],
  ["推演 GEO 可见度缺口", "分析内容缺口"],
  ["形成 GEO 评分与优化任务", "形成内容评分与优化任务"],
  ["GEO 评分与优化任务", "内容评分与优化任务"],
  ["GEO 评分", "内容评分"],
  ["GEO评分", "内容评分"],
  ["「GEO 评分」", "「内容评分」"],
  ["GEO 诊断", "内容诊断"],
  ["GEO诊断", "内容诊断"],
  ["GEO 综合评分", "内容综合评分"],
  ["本轮 GEO 综合评分", "本轮内容综合评分"],
  ["GEO 综合", "内容综合"],
  ["GEO 可见度", "内容覆盖"],
  ["可见度评分", "内容覆盖评分"],
  ["可见度缺口", "内容缺口"],
  ["可见度与缺口推演", "内容缺口"],
  ["可见度与内容缺口", "内容缺口"],
  ["按问题维度输出的可见度与缺口推演", "按问题维度输出的内容缺口分析"],
  ["AI 可见度", "内容覆盖"],
  ["可见度", "内容覆盖"],
  ["推演：", "分析："],
  ["推演", "分析"],
  ["资产库", "内容资料"],
  ["质检分数", "质量评分"],
  ["质检状态", "质量状态"],
  ["质检结果", "质量检查结果"],
  ["质检摘要", "质量检查摘要"],
  ["质检详情", "质量检查详情"],
  ["质检区", "质量检查区"],
  ["质检阻断", "需要修改"],
  ["重新质检中…", "重新检查中…"],
  ["重新质检中", "重新检查中"],
  ["重新质检", "重新检查"],
  ["待质检", "待检查"],
  ["未质检", "未检查"],
  ["质检未通过", "质量未通过"],
  ["质检通过", "质量通过"],
  ["查看质检结果", "查看质量检查结果"],
  ["等待质检结果", "等待质量检查结果"],
  ["自动质检", "自动质量检查"],
  ["完成质检", "完成质量检查"],
  ["运行 AI 诊断", "运行内容诊断"],
  ["运行AI诊断", "运行内容诊断"],
  ["重新运行 AI 诊断", "重新诊断"],
  ["进入 AI 诊断", "进入内容诊断"],
  ["进入AI诊断", "进入内容诊断"],
  ["AI 诊断", "内容诊断"],
  ["AI诊断", "内容诊断"],
  ["GEO 内容页", "公开内容页"],
  ["GEO 内容计划", "内容计划"],
  ["GEO 内容", "内容"],
  ["GEO内容", "内容"],
  ["GEO 文章", "文章"],
  ["GEO文章", "文章"],
  ["GEO 增长", "内容增长"],
  ["GEO增长", "内容增长"],
  ["GEO ", "内容增长系统 "],
  [" GEO", " 内容增长系统"],
  ["GEO", "内容增长系统"],
];

const DELETIONS = [
  "无需再录入各平台原始回答（历史导入数据仍保留在库中，不参与本流程）。",
  "无需再录入各平台原始回答（历史导入数据仍保留在库中，不参与本流程）",
  "（历史导入数据仍保留在库中，不参与本流程）",
  "反同质化结果当前为轻量规则计算，未写入数据库；不是复杂语义向量相似度。",
  "轻量规则检查标题、选题、结构、观点和同任务重复。",
  "暂未发现明显标题重复；本轮仅做轻量规则提示，不代表深度语义相似度检查。",
  "反同质化是轻量规则检查，不是深度语义相似度。",
  "不是深度语义相似度。",
];

/** Backend / API status literals — restore after broad 质检/可见度 replacements */
const STATUS_REVERT = [
  ['=== "质量通过"', '=== "质检通过"'],
  ['!== "质量通过"', '!== "质检通过"'],
  ['=== "质量未通过"', '=== "质检未通过"'],
  ['"质量未通过"', '"质检未通过"'],
  ['"未检查"', '"未质检"'],
  ['"待检查"', '"待质检"'],
  ['"质量未通过", "待审核"', '"质检未通过", "待审核"'],
  ['["未检查", "质量未通过"', '["未质检", "质检未通过"'],
  ['["需人工审核", "质量未通过", "待检查"', '["需人工审核", "质检未通过", "待质检"'],
  ['status === "质量通过" ? "质量通过"', 'status === "质检通过" ? "质检通过"'],
  ['finalStatus === "质量通过" ? "质量通过"', 'finalStatus === "质检通过" ? "质检通过"'],
  ['article.status === "待检查"', 'article.status === "待质检"'],
  ['selectedArticle.status === "待检查"', 'selectedArticle.status === "待质检"'],
  ['/** 与步骤 5「质量通过」', '/** 与步骤 5「质检通过」'],
  ['（状态为质量通过或总分达参考线）', '（状态为质检通过或总分达参考线）'],
  ['GEO_ARTICLE', 'GEO_ARTICLE'],
];

const SKIP = new Set(["client/src/components/Map.tsx"]);

function processFile(path) {
  const rel = path.replace(root + "/", "");
  if (SKIP.has(rel)) return false;
  let s = readFileSync(path, "utf8");
  const before = s;
  for (const [a, b] of REPLACEMENTS) {
    if (a) s = s.split(a).join(b);
  }
  for (const line of DELETIONS) {
    s = s.split(line).join("");
  }
  // cleanup double spaces / empty desc fragments
  s = s.replace(/。\s*。/g, "。");
  s = s.replace(/，\s*，/g, "，");
  s = s.replace(/desc=""\s*/g, "");
  s = s.replace(/risk="[^"]*差异度是轻量[^"]*"/g, 'risk="本页不做平台授权、不发布、不写发布记录。"');
  for (const [a, b] of STATUS_REVERT) {
    if (a !== b) s = s.split(a).join(b);
  }
  // Fix over-replacement of GEO in imports/constants
  s = s.replace(/内容增长系统_ARTICLE/g, "GEO_ARTICLE");
  s = s.replace(/内容增长系统_TASK_CARD/g, "GEO_TASK_CARD");
  s = s.replace(/内容增长系统CODER/g, "GEOCODER");
  s = s.replace(/内容增长系统METRY/g, "GEOMETRY");
  if (s !== before) {
    writeFileSync(path, s, "utf8");
    return true;
  }
  return false;
}

function walkTsx(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTsx(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = walkTsx(resolve(root, "client"));
const changed = files.filter(processFile);
console.log(`Updated ${changed.length} files:`);
changed.forEach(f => console.log(" -", f.replace(root + "/", "")));
