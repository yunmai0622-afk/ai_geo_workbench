# GEO 本地发布客户端安装包

线上部署前在本机构建并复制到此目录：

```bash
cd local-agent && npm run package:mac
# 或：npm run build && node ../scripts/copy_local_agent_download.mjs
```

产物文件名（相对路径，适配任意域名）：

- `/downloads/geo-local-agent-mac.zip`
- `/downloads/geo-local-agent-mac.dmg`

`manifest.json` 记录当前已复制文件；大体积安装包不纳入 Git（超过 GitHub 单文件限制时请通过部署流水线或对象存储上传）。
