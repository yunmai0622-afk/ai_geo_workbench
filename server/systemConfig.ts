/**
 * 系统级合规与发布边界（由原 `compliance_rules` / `publish_strategies` 沉淀为代码常量，
 * 不再依赖客户在档案页填写；历史 DB 表保留只读，新数据不再写入）。
 */

export const SYSTEM_COMPLIANCE_RULE_NAME = "系统默认 GEO 合规";

/** 与历史库中常见规则对齐的禁用词（用于预发布扫描） */
export const SYSTEM_FORBIDDEN_WORDS = [
  "保证收录",
  "保证排名",
  "保证推荐",
  "保证成交",
  "百分百转化",
  "替代全部人工",
  "一定收录",
  "一定排名",
  "100%",
  "绝对第一",
  "自动代发第三方平台",
] as const;

/** 禁止对外承诺类主张（与 `forbiddenClaims` 文本字段用法一致，按行/顿号拆分由调用方处理） */
export const SYSTEM_FORBIDDEN_CLAIMS_TEXT = [
  "包效果",
  "唯一指定",
  "不切实际的效果承诺",
  "未经验证的排名与转化率断言",
].join("\n");

/** 对外内容必须体现的披露与口径（展示与提示用） */
export const SYSTEM_REQUIRED_DISCLAIMERS =
  "对外发布内容须标注「效果因客户与市场而异」；涉及数据须说明来源或已脱敏；不得将 AI 引用等同于官方背书。";

/** 发布边界与审核策略摘要（替代原 `publish_strategies` 行拼接） */
export const SYSTEM_PUBLISH_STRATEGY_LINES = [
  "审核模式：全人工审核；不自动登录第三方平台、不保存客户平台账号密码。",
  "质量阈值：以系统 GEO 质检最低分为准；不承诺收录、排名或 AI 推荐。",
  "平台边界：仅记录人工发布结果与公开链接，不调用外部平台代发文接口。",
] as const;

export type SystemComplianceRuleRow = {
  ruleName: string;
  forbiddenWords: readonly string[];
  forbiddenClaims: string;
  requiredDisclaimers: string;
  enabled: number;
};

/** 与 DB `compliance_rules` 行字段兼容，供 `evaluateAssetLibraryPrePublishCheck` 使用 */
export function getSystemComplianceRulesForPrePublish(): SystemComplianceRuleRow[] {
  return [
    {
      ruleName: SYSTEM_COMPLIANCE_RULE_NAME,
      forbiddenWords: [...SYSTEM_FORBIDDEN_WORDS],
      forbiddenClaims: SYSTEM_FORBIDDEN_CLAIMS_TEXT,
      requiredDisclaimers: SYSTEM_REQUIRED_DISCLAIMERS,
      enabled: 1,
    },
  ];
}

/** 供 `buildAssetLibraryUsage` 中 `complianceRules: string[]` 展示 */
export function getSystemComplianceUsageLines(): string[] {
  return getSystemComplianceRulesForPrePublish().map(item =>
    [item.ruleName, item.forbiddenClaims, item.requiredDisclaimers].filter(Boolean).join("："),
  );
}
