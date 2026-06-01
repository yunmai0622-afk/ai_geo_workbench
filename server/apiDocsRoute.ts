import type { Express, Request, Response } from "express";
import type { User } from "../drizzle/schema";
import { API_DOC_SECTIONS } from "./apiDocs";
import { sdk } from "./_core/sdk";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function authLabel(auth: string): string {
  if (auth === "protected") return "需登录";
  if (auth === "admin") return "管理员";
  return "公开";
}

function renderUnauthorizedHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API 文档 — 需要登录</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>需要登录</h1>
  <p>请先登录系统后再访问 API 文档。</p>
  <p><a href="/">返回首页登录</a></p>
</body>
</html>`;
}

function renderDocsHtml(user: User): string {
  const sections = API_DOC_SECTIONS.map(section => {
    const rows = section.entries
      .map(
        entry => `<tr>
  <td><code>${escapeHtml(entry.path)}</code></td>
  <td>${escapeHtml(entry.type)}</td>
  <td>${escapeHtml(authLabel(entry.auth))}</td>
  <td>${escapeHtml(entry.summary)}</td>
</tr>`,
      )
      .join("\n");
    return `<section id="${escapeHtml(section.id)}">
  <h2>${escapeHtml(section.title)}</h2>
  <p class="section-desc">${escapeHtml(section.description)}</p>
  <table>
    <thead>
      <tr><th>过程路径</th><th>类型</th><th>鉴权</th><th>说明</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</section>`;
  }).join("\n");

  const nav = API_DOC_SECTIONS.map(
    s => `<a href="#${escapeHtml(s.id)}">${escapeHtml(s.title)}</a>`,
  ).join(" · ");

  const viewer = escapeHtml(user.name || user.email || `用户 #${user.id}`);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GEO API 文档</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #111; background: #f8fafc; }
    header { background: #0f172a; color: #f8fafc; padding: 1.25rem 1.5rem; }
    header h1 { margin: 0 0 0.35rem; font-size: 1.35rem; }
    header p { margin: 0; opacity: 0.85; font-size: 0.9rem; }
    main { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
    nav { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.9rem; }
    nav a { color: #2563eb; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    section { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem 1.25rem; margin-bottom: 1rem; }
    section h2 { margin: 0 0 0.35rem; font-size: 1.1rem; }
    .section-desc { margin: 0 0 0.75rem; color: #475569; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    code { font-size: 0.8rem; background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 4px; }
    .meta { margin-top: 1rem; font-size: 0.85rem; color: #64748b; }
    .meta code { background: #e2e8f0; }
  </style>
</head>
<body>
  <header>
    <h1>GEO tRPC API 文档</h1>
    <p>Phase GEO-V1.1-API-Docs · 当前用户：${viewer}</p>
  </header>
  <main>
    <nav>${nav}</nav>
    <p class="meta">HTTP 端点：<code>POST/GET /api/trpc/&lt;procedurePath&gt;</code> · 序列化：<code>superjson</code> · 会话：<code>app_session_id</code> Cookie</p>
${sections}
  </main>
</body>
</html>`;
}

export function registerApiDocsRoute(app: Express) {
  app.get("/api/docs", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.status(200).type("html").send(renderDocsHtml(user));
    } catch {
      res.status(401).type("html").send(renderUnauthorizedHtml());
    }
  });
}
