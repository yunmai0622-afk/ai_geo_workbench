# Legacy：Chrome 发布助手（已停用主链路）

该 Chrome 插件为早期发布助手方案，当前正式发布主链路已切换为 **Electron + Playwright Local Agent**。

该目录仅作为历史兼容与回滚参考，**不再作为客户默认发布方式**。

## 客户应使用什么

- 下载并启动 **GEO 本地发布客户端**（见 Web 企业档案 → 平台账号绑定区）
- 在本机完成平台登录与账号绑定
- 在「内容资产生产」页创建发布任务，由客户端拉取 `pending_agent` 任务执行

## 工程说明

- 源码目录：`content-growth-publish-extension/`
- 历史安装包：`client/public/browser-extension.zip`（仅交付回滚，主 UI 不提供下载入口）
- 服务端 `publishTasks.downloadExtension` 标记为 `@legacy`，主流程不调用
