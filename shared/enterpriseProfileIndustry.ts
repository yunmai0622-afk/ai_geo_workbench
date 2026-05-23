/** 企业档案行业方向（字符串字段，非 DB enum） */

export const ENTERPRISE_INDUSTRY_OPTIONS = [
  "知识付费 / 教育培训",
  "内容电商",
  "本地生活",
  "企业服务 / SaaS",
  "财税法务",
  "医美健康",
  "房产家居",
  "招商加盟",
  "实体门店",
  "职业培训",
  "咨询服务",
  "个人 IP / 专家型服务",
  "B2B 制造 / 工业品",
  "其他",
] as const;

export type EnterpriseIndustryOption = (typeof ENTERPRISE_INDUSTRY_OPTIONS)[number];

/** 旧档案行业值 → 新选项 */
export const LEGACY_INDUSTRY_MAP: Record<string, EnterpriseIndustryOption | string> = {
  知识付费: "知识付费 / 教育培训",
  在线教育: "知识付费 / 教育培训",
  教育培训机构: "知识付费 / 教育培训",
  个人IP: "个人 IP / 专家型服务",
  内容电商: "内容电商",
  企业服务: "企业服务 / SaaS",
};

export const industryPainPointOptions: Record<string, readonly string[]> = {
  "知识付费 / 教育培训": [
    "流量有但不成交",
    "私域转化率低",
    "直播没有转化",
    "课程卖不动",
    "学员完课率低",
    "助教交付压力大",
    "复购率低",
    "客户不知道选什么课",
    "内容持续产出难",
  ],
  内容电商: [
    "短视频有播放但不出单",
    "直播间转化率低",
    "商品卖点表达不清",
    "用户信任不足",
    "复购率低",
    "内容种草弱",
    "竞品同质化严重",
    "达人合作效果不稳定",
  ],
  本地生活: [
    "到店客流不稳定",
    "线上获客成本高",
    "团购转化低",
    "差评影响大",
    "复购率低",
    "门店内容不会做",
    "同城竞争同质化",
    "私域沉淀难",
  ],
  "企业服务 / SaaS": [
    "客户不知道产品价值",
    "销售线索质量低",
    "客户决策周期长",
    "官网内容无法转化",
    "竞品对比不占优",
    "客户成功压力大",
    "续费理由不足",
    "案例说服力弱",
  ],
  财税法务: [
    "客户信任建立难",
    "线索质量低",
    "服务同质化",
    "合规表达风险高",
    "客单价高难转化",
    "案例不便公开",
    "续费理由不足",
    "获客渠道单一",
  ],
  医美健康: [
    "客户信任不足",
    "获客成本高",
    "竞品价格战",
    "案例不便公开",
    "复购周期长",
    "内容合规要求高",
    "到店转化低",
    "品牌差异化弱",
  ],
  房产家居: [
    "客户信任建立难",
    "线索成本高",
    "内容同质化严重",
    "客户决策周期长",
    "私域跟进难",
    "本地案例不足",
    "高客单成交难",
    "渠道依赖中介",
  ],
  招商加盟: [
    "招商线索质量低",
    "品牌信任不足",
    "竞品政策对比难",
    "落地支持说不清",
    "招商内容同质化",
    "转化周期长",
    "区域市场差异大",
    "加盟商顾虑多",
  ],
  实体门店: [
    "到店客流不足",
    "线上引流难",
    "会员复购低",
    "同城竞争强",
    "门店内容不会做",
    "促销依赖严重",
    "员工执行力不足",
    "品牌认知弱",
  ],
  职业培训: [
    "招生线索质量低",
    "课程卖点不清",
    "就业结果难证明",
    "竞品课程同质化",
    "口碑传播弱",
    "续报率低",
    "渠道投放 ROI 低",
    "教学交付压力大",
  ],
  咨询服务: [
    "客户决策周期长",
    "服务价值难量化",
    "案例不便公开",
    "线索质量低",
    "信任建立难",
    "客单价高难成交",
    "内容专业但难懂",
    "复购理由不足",
  ],
  "个人 IP / 专家型服务": [
    "流量有但不成交",
    "人设定位不清",
    "内容持续产出难",
    "私域转化率低",
    "课程/服务卖不动",
    "信任建立周期长",
    "竞品专家多",
    "交付精力不足",
  ],
  "B2B 制造 / 工业品": [
    "客户决策周期长",
    "技术参数难讲清",
    "案例说服力弱",
    "线索质量低",
    "渠道依赖经销商",
    "品牌认知弱",
    "竞品同质化",
    "售后问题影响口碑",
  ],
  其他: [
    "获客成本高",
    "转化率低",
    "品牌认知不足",
    "内容不会做",
    "竞品压力大",
    "客户信任不足",
    "复购率低",
    "决策周期长",
  ],
};

const ALL_PRESET_PAINS = new Set(
  Object.values(industryPainPointOptions).flatMap(list => [...list]),
);

export function resolveIndustryFromStored(stored: string): { select: string; custom: string } {
  const t = stored.trim();
  if (!t) return { select: ENTERPRISE_INDUSTRY_OPTIONS[0], custom: "" };
  if ((ENTERPRISE_INDUSTRY_OPTIONS as readonly string[]).includes(t)) return { select: t, custom: "" };
  const mapped = LEGACY_INDUSTRY_MAP[t];
  if (mapped && (ENTERPRISE_INDUSTRY_OPTIONS as readonly string[]).includes(mapped)) {
    return { select: mapped, custom: "" };
  }
  return { select: "其他", custom: t };
}

export function getPainOptionsForIndustry(industry: string): readonly string[] {
  const key = industry.trim();
  return industryPainPointOptions[key] ?? industryPainPointOptions["其他"] ?? [];
}

export function isPresetPainForIndustry(pain: string, industry: string): boolean {
  return getPainOptionsForIndustry(industry).includes(pain);
}

export function isAnyPresetPain(pain: string): boolean {
  return ALL_PRESET_PAINS.has(pain);
}
