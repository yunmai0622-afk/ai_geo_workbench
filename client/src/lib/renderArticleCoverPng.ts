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

/** 浏览器端：SVG 模板 → Canvas → PNG base64（中文由系统字体渲染） */
export async function renderArticleCoverPng(params: RenderArticleCoverPngParams): Promise<RenderArticleCoverPngResult> {
  const svg = buildArticleCoverSvg(params);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  try {
    const img = await loadImage(svgDataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = COVER_WIDTH;
    canvas.height = COVER_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
    ctx.drawImage(img, 0, 0, COVER_WIDTH, COVER_HEIGHT);
    const dataUrl = canvas.toDataURL("image/png");
    const coverBase64 = dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : "";
    if (!coverBase64) throw new Error("封面导出失败");
    return { coverBase64, dataUrl };
  } catch (primaryError) {
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = await loadImage(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = COVER_WIDTH;
      canvas.height = COVER_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法创建画布");
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
      ctx.drawImage(img, 0, 0, COVER_WIDTH, COVER_HEIGHT);
      const dataUrl = canvas.toDataURL("image/png");
      const coverBase64 = dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : "";
      if (!coverBase64) throw new Error("封面导出失败");
      return { coverBase64, dataUrl };
    } catch (fallbackError) {
      const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`封面生成失败：${primaryMsg}；回退亦失败：${fallbackMsg}`);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("封面预览加载失败"));
    img.src = src;
  });
}
