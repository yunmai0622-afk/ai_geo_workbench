import { GENERIC_UNAUTHORIZED_MESSAGE, toUserFacingErrorFromUnknown } from "./userFacingErrors";

export function mapArticleAssetSaveError(err: unknown, fallback = "保存失败"): string {
  const raw =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message ?? "")
        : "";
  const message = raw.trim();

  if (!message) return toUserFacingErrorFromUnknown(err, fallback);

  if (/UNAUTHORIZED|登录状态|请重新登录/i.test(message)) {
    return GENERIC_UNAUTHORIZED_MESSAGE;
  }
  if (/未找到属于当前项目的内容|内容不存在|文章不存在/i.test(message)) {
    return "未找到该内容，请刷新页面后重试";
  }
  if (/articleId|内容ID|文章ID/i.test(message) && /缺失|无效|不能为空/i.test(message)) {
    return "内容 ID 缺失，请关闭编辑窗口后重新打开";
  }
  if (/平台稿|platformDraft/i.test(message) && /不存在|未找到/i.test(message)) {
    return "平台稿不存在，请重新生成该平台内容";
  }
  if (/标题不能为空|正文不能为空|标题和正文/.test(message)) {
    return "标题和正文不能为空，请填写后再保存";
  }
  if (/封面图无效|封面导出为空|重新生成封面/.test(message)) {
    return message;
  }
  if (/数据库不可用|INTERNAL_SERVER_ERROR|服务器开小差|服务暂时不可用/i.test(message)) {
    return "服务器暂时不可用，请稍后重试";
  }

  return toUserFacingErrorFromUnknown(err, fallback);
}
