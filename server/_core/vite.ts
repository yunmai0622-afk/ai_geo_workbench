import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const DOWNLOAD_ARTIFACT_RE = /^\/downloads\/[^/]+\.(zip|dmg|exe)$/i;

export function clientDownloadsDir() {
  return path.resolve(process.cwd(), "client", "public", "downloads");
}

export function distPublicDir() {
  return path.resolve(process.cwd(), "dist", "public");
}

/** 缺失安装包时返回 404，禁止 SPA index.html 冒充 zip（约 4KB 假文件） */
export function registerDownloadArtifactGuard(app: Express, publicRoot: string) {
  app.use((req, res, next) => {
    if (!DOWNLOAD_ARTIFACT_RE.test(req.path)) {
      next();
      return;
    }
    const filePath = path.join(publicRoot, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      next();
      return;
    }
    res
      .status(404)
      .type("text/plain; charset=utf-8")
      .send(
        "Download artifact not found. Build with a valid geo-local-agent-mac.zip or set AGENT_MAC_ZIP_URL.",
      );
  });
}

export async function setupVite(app: Express, server: Server) {
  const downloadsDir = clientDownloadsDir();
  if (fs.existsSync(downloadsDir)) {
    app.use("/downloads", express.static(downloadsDir));
    registerDownloadArtifactGuard(app, downloadsDir);
  }

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    if (DOWNLOAD_ARTIFACT_RE.test(req.path)) {
      next();
      return;
    }

    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // 固定从项目根 dist/public 提供静态资源，避免 bundled 后 import.meta.dirname 歧义导致读到旧目录
  const distPath = distPublicDir();
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to run pnpm build first`,
    );
  }

  app.use(express.static(distPath));
  registerDownloadArtifactGuard(app, distPath);

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    if (DOWNLOAD_ARTIFACT_RE.test(req.path)) {
      res
        .status(404)
        .type("text/plain; charset=utf-8")
        .send(
          "Download artifact not found. Deploy geo-local-agent-mac.zip or set AGENT_MAC_ZIP_URL.",
        );
      return;
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
