/**
 * 火山引擎图像生成工具
 * 文档：https://www.volcengine.com/docs/82379/1399008
 */

const VOLC_API_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

function getApiKey(): string {
  const key = process.env.ARK_API_KEY || process.env.VOLC_API_KEY || "";
  if (!key) throw new Error("火山引擎 API Key 未配置（ARK_API_KEY）");
  return key;
}

export async function generateCoverImage(articleTitle: string): Promise<string | null> {
  try {
    const prompt = `专业知识分享文章封面图，主题：${articleTitle}。风格：简洁商务，蓝色调，配合文字排版，高清，适合知乎文章封面，16:9比例`;

    const res = await fetch(VOLC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: "doubao-seedream-3-0-t2i-250415",
        prompt,
        size: "1280x720",
        n: 1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[封面图] 火山引擎图像生成失败 HTTP ${res.status}:`, errText);
      return null;
    }

    const data = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
    const imageUrl = data?.data?.[0]?.url ?? null;

    if (imageUrl) {
      console.log(`[封面图] 生成成功: ${imageUrl}`);
    } else {
      console.warn("[封面图] 返回数据中没有 url 字段:", JSON.stringify(data));
    }

    return imageUrl;
  } catch (e) {
    console.error("[封面图] 生成异常:", e);
    return null;
  }
}
