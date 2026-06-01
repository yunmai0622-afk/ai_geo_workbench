import {
  buildArticleCoverSvg,
  type ArticleCoverTemplateId,
  COVER_HEIGHT,
  COVER_WIDTH,
} from "@shared/articleCoverTemplate";
import { encodeStoredCoverBase64, encodeSvgStringToBase64 } from "@shared/articleCoverBase64";

export type RenderArticleCoverPngParams = {
  template: ArticleCoverTemplateId;
  title: string;
  brandName?: string;
};

export type RenderArticleCoverPngResult = {
  coverBase64: string;
  dataUrl: string;
  mime: "image/png" | "image/svg+xml";
};

function exportSvgToPngBase64(svg: string): Promise<RenderArticleCoverPngResult> {
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return rasterizeSvgSource(svgDataUrl).catch(() => {
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    return rasterizeSvgSource(objectUrl).finally(() => URL.revokeObjectURL(objectUrl));
  });
}

function exportSvgToStoredBase64(svg: string): RenderArticleCoverPngResult {
  const base64 = encodeSvgStringToBase64(svg);
  const coverBase64 = encodeStoredCoverBase64({ mime: "image/svg+xml", base64 });
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  return { coverBase64, dataUrl, mime: "image/svg+xml" };
}

async function rasterizeSvgSource(src: string): Promise<RenderArticleCoverPngResult> {
  if (typeof createImageBitmap === "function" && typeof fetch === "function") {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      try {
        return canvasFromBitmap(bitmap);
      } finally {
        bitmap.close();
      }
    } catch {
      /* fall through to Image */
    }
  }

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
  return { coverBase64, dataUrl, mime: "image/png" };
}

function canvasFromBitmap(bitmap: ImageBitmap): RenderArticleCoverPngResult {
  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  ctx.drawImage(bitmap, 0, 0, COVER_WIDTH, COVER_HEIGHT);
  const dataUrl = canvas.toDataURL("image/png");
  const coverBase64 = dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : "";
  if (!coverBase64) throw new Error("封面导出失败");
  return { coverBase64, dataUrl, mime: "image/png" };
}

/** 浏览器端：SVG 模板 → PNG base64（失败时回退为 SVG base64，带 svg: 存储前缀） */
export async function renderArticleCoverPng(params: RenderArticleCoverPngParams): Promise<RenderArticleCoverPngResult> {
  if (typeof document === "undefined") {
    throw new Error("renderArticleCoverPng 仅能在浏览器环境运行");
  }
  const svg = buildArticleCoverSvg(params);
  try {
    return await exportSvgToPngBase64(svg);
  } catch (e) {
    console.warn("[cover] Canvas PNG 导出失败，回退 SVG base64", e);
    const fallback = exportSvgToStoredBase64(svg);
    if (!fallback.coverBase64?.trim()) {
      throw e instanceof Error ? e : new Error(String(e));
    }
    return fallback;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      if (typeof img.decode === "function") {
        void img.decode().then(() => resolve(img)).catch(() => resolve(img));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error(`封面 SVG 加载失败: ${src.slice(0, 80)}…`));
    img.src = src;
  });
}
