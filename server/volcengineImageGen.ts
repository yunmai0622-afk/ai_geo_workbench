/**
 * 封面图生成工具
 * 复用项目内置的 generateImage（Manus Forge API），无需额外配置 API Key
 */
import { generateImage } from "./_core/imageGeneration";

export async function generateCoverImage(articleTitle: string): Promise<string | null> {
  try {
    const prompt = `专业知识分享文章封面图，主题：${articleTitle}。风格：简洁商务，蓝色调，配合文字排版，高清，适合知乎文章封面，16:9比例`;

    console.log(`[封面图] 开始生成，标题: ${articleTitle}`);
    const { url } = await generateImage({ prompt });

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
