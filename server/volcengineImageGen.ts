/**
 * 封面图生成工具
 * 复用项目内置的 generateImage（Manus Forge API），无需额外配置 API Key
 *
 * 更高画质依赖 Forge/火山侧模型（如 doubao-seedream-3-0 系列），请在控制台确认已开通。
 */
import { generateImage } from "./_core/imageGeneration";

const COVER_WIDTH = 1440;
const COVER_HEIGHT = 810;

export async function generateCoverImage(articleTitle: string): Promise<string | null> {
  try {
    const prompt = `知乎专栏文章封面图，主题：${articleTitle}。
要求：极简现代设计风格，深色背景（深蓝或深灰），大字排版突出主题关键词，
配合简洁的线条图形或图标，专业感强，适合知识付费内容，
禁止出现任何文字水印，禁止卡通风格，禁止人脸特写，16:9横版构图`;

    console.log(`[封面图] 开始生成，标题: ${articleTitle}，尺寸: ${COVER_WIDTH}x${COVER_HEIGHT}`);
    const { url } = await generateImage({
      prompt,
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
    });

    if (url) {
      console.log(`[封面图] 生成成功: ${url}`);
    } else {
      console.warn("[封面图] 生成返回空 url");
    }

    return url ?? null;
  } catch (e) {
    console.error("[封面图] 生成异常:", e);
    return null;
  }
}
