import {
  buildArticleCoverSvg,
  type ArticleCoverTemplateId,
  COVER_HEIGHT,
  COVER_WIDTH,
} from "@shared/articleCoverTemplate";

export type RenderArticleCoverPngParams = {
  template: ArticleCoverTemplateId;
  title: string;
  brandName?: string;
};

export type RenderArticleCoverPngResult = {
  coverBase64: string;
  dataUrl: string;
};

function exportSvgToPngBase64(svg: string): Promise<RenderArticleCoverPngResult> {
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return rasterizeSvgSource(svgDataUrl).catch(() => {
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    return rasterizeSvgSource(objectUrl).finally(() => URL.revokeObjectURL(objectUrl));
  });
}

async function rasterizeSvgSource(src: string): Promise<RenderArticleCoverPngResult> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  ctx.drawImage(img, 0, 0, COVER_WIDTH, COVER_HEIGHT);
  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Canvas 导出 PNG 失败（可能为浏览器安全限制）: ${msg}`);
  }
  const coverBase64 = dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : "";
  if (!coverBase64) throw new Error("封面导出失败");
  return { coverBase64, dataUrl };
}

/** 浏览器端：SVG 模板 → Canvas → PNG base64（依赖 DOM：Image + canvas，仅客户端可运行） */
export async function renderArticleCoverPng(params: RenderArticleCoverPngParams): Promise<RenderArticleCoverPngResult> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    throw new Error("renderArticleCoverPng 仅能在浏览器环境运行");
  }
  const svg = buildArticleCoverSvg(params);
  try {
    return await exportSvgToPngBase64(svg);
  } catch (e) {
    console.error("[cover-debug] renderArticleCoverPng 失败", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`封面 SVG 加载失败: ${src.slice(0, 80)}…`));
    img.src = src;
  });
}
