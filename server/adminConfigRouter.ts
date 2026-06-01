import { z } from "zod";
import { DEFAULT_MANUAL_PUBLISH_PLATFORMS } from "@shared/geoSystemConfig";
import {
  loadGeoSystemConfig,
  loadSystemAnnouncementPublic,
  saveGeoSystemConfig,
  saveSystemAnnouncement,
} from "./geoSystemConfigStore";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";

const configInputSchema = z.object({
  contentGenerationPerMinuteLimit: z.number().int().min(1).max(120),
  t0DetectionPerHourLimit: z.number().int().min(1).max(100),
  qualityMinPassScore: z.number().int().min(0).max(100),
  defaultPublishPlatforms: z
    .array(z.string().trim().min(1).max(120))
    .min(1, "至少保留一个发布平台")
    .max(30),
});

const announcementInputSchema = z
  .object({
    enabled: z.boolean(),
    body: z.string().max(4000),
  })
  .superRefine((val, ctx) => {
    if (val.enabled && !val.body.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "开启公告时请填写公告内容",
        path: ["body"],
      });
    }
  });

export const adminConfigRouter = router({
  /** 管理员：读取完整系统配置 */
  get: adminProcedure.query(async () => loadGeoSystemConfig()),

  /** 管理员：更新系统配置（写入数据库，环境变量仍可作为缺省兜底） */
  update: adminProcedure.input(configInputSchema).mutation(async ({ ctx, input }) => {
    const uniquePlatforms = [...new Set(input.defaultPublishPlatforms.map(p => p.trim()).filter(Boolean))];
    return saveGeoSystemConfig(
      {
        contentGenerationPerMinuteLimit: input.contentGenerationPerMinuteLimit,
        t0DetectionPerHourLimit: input.t0DetectionPerHourLimit,
        qualityMinPassScore: input.qualityMinPassScore,
        defaultPublishPlatforms: uniquePlatforms,
      },
      ctx.user.id,
    );
  }),

  /** 已登录用户：发布平台与质检及格线（只读，供业务页展示） */
  publishSettings: protectedProcedure.query(async () => {
    const cfg = await loadGeoSystemConfig();
    return {
      qualityMinPassScore: cfg.qualityMinPassScore,
      defaultPublishPlatforms: cfg.defaultPublishPlatforms,
      fallbackPlatforms: [...DEFAULT_MANUAL_PUBLISH_PLATFORMS],
    } as const;
  }),

  /** 管理员：发布或关闭系统公告 */
  updateAnnouncement: adminProcedure.input(announcementInputSchema).mutation(async ({ ctx, input }) => {
    return saveSystemAnnouncement(input, ctx.user.id);
  }),

  /** 已登录用户：当前系统公告（顶部横幅） */
  systemAnnouncement: protectedProcedure.query(async () => loadSystemAnnouncementPublic()),
});
