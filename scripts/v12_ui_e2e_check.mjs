// 轻量端到端 UI 验收入口。
// 该脚本以客户路径页面为端到端验收单位，检查首页、导航、8 个核心页面、状态引导条、关键业务文案与中文占位规则。
// 运行方式：node scripts/v12_ui_e2e_check.mjs
await import('./v12_ui_acceptance_check.mjs');
