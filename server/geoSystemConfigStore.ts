import { eq } from "drizzle-orm";
import {
  DEFAULT_MANUAL_PUBLISH_PLATFORMS,
  GEO_SYSTEM_ANNOUNCEMENT_DEFAULTS,
  GEO_SYSTEM_CONFIG_DEFAULTS,
  type GeoSystemConfigSnapshot,
} from "@shared/geoSystemConfig";
import type { SystemAnnouncementPublic } from "@shared/systemAnnouncement";
import { geoSystemConfig } from "../drizzle/schema";
import { getDb } from "./db";
import type { RateLimitConfig } from "./memoryRateLimit";

type GeoSystemConfigValues = Omit<GeoSystemConfigSnapshot, "source" | "updatedAt">;
type GeoSystemConfigRunParams = Omit<GeoSystemConfigValues, "systemAnnouncement">;

let cached: GeoSystemConfigSnapshot | null = null;

/** 进程内同步快照（启动后首次 load 前为内置默认） */
let syncValues: GeoSystemConfigValues = { ...GEO_SYSTEM_CONFIG_DEFAULTS };

export function getQualityMinPassScoreSync(): number {
  return syncValues.qualityMinPassScore;
}

export function getDefaultPublishPlatformsSync(): string[] {
  return syncValues.defaultPublishPlatforms;
}

function applySyncValues(values: GeoSystemConfigValues): void {
  syncValues = values;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return n;
}

function parsePublishPlatformsEnv(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const items = raw
    .split(/[,，\n]/)
    .map(s => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function readEnvOverrides(): Partial<GeoSystemConfigValues> & { source?: GeoSystemConfigSnapshot["source"] } {
  const out: Partial<GeoSystemConfigValues> = {};
  let hasEnv = false;

  const contentGenerationPerMinuteLimit = parsePositiveInt(
    process.env.GEO_CONTENT_GENERATION_PER_MINUTE_LIMIT,
  );
  if (contentGenerationPerMinuteLimit != null) {
    out.contentGenerationPerMinuteLimit = contentGenerationPerMinuteLimit;
    hasEnv = true;
  }

  const t0DetectionPerHourLimit = parsePositiveInt(process.env.GEO_T0_DETECTION_PER_HOUR_LIMIT);
  if (t0DetectionPerHourLimit != null) {
    out.t0DetectionPerHourLimit = t0DetectionPerHourLimit;
    hasEnv = true;
  }

  const qualityMinPassScore = parsePositiveInt(process.env.GEO_QUALITY_MIN_PASS_SCORE);
  if (qualityMinPassScore != null) {
    out.qualityMinPassScore = qualityMinPassScore;
    hasEnv = true;
  }

  const defaultPublishPlatforms = parsePublishPlatformsEnv(process.env.GEO_DEFAULT_PUBLISH_PLATFORMS);
  if (defaultPublishPlatforms) {
    out.defaultPublishPlatforms = defaultPublishPlatforms;
    hasEnv = true;
  }

  return hasEnv ? { ...out, source: "environment" as const } : out;
}

function mergeConfig(
  base: GeoSystemConfigValues,
  source: GeoSystemConfigSnapshot["source"],
  updatedAt: string | null,
): GeoSystemConfigSnapshot {
  return {
    ...base,
    source,
    updatedAt,
  };
}

function announcementFromRow(row: typeof geoSystemConfig.$inferSelect): SystemAnnouncementPublic {
  const body = typeof row.systemAnnouncementBody === "string" ? row.systemAnnouncementBody : "";
  const enabled = row.systemAnnouncementEnabled === 1;
  const versionKey = row.systemAnnouncementUpdatedAt
    ? new Date(row.systemAnnouncementUpdatedAt).toISOString()
    : null;
  return { enabled, body, versionKey };
}

function rowToValues(row: typeof geoSystemConfig.$inferSelect): GeoSystemConfigValues {
  const platforms = Array.isArray(row.defaultPublishPlatforms)
    ? row.defaultPublishPlatforms.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];
  return {
    contentGenerationPerMinuteLimit: row.contentGenerationPerMinuteLimit,
    t0DetectionPerHourLimit: row.t0DetectionPerHourLimit,
    qualityMinPassScore: row.qualityMinPassScore,
    defaultPublishPlatforms: platforms.length > 0 ? platforms : [...DEFAULT_MANUAL_PUBLISH_PLATFORMS],
    systemAnnouncement: announcementFromRow(row),
  };
}

async function readAnnouncementFromDb(): Promise<SystemAnnouncementPublic> {
  const db = await getDb();
  if (!db) return { ...GEO_SYSTEM_ANNOUNCEMENT_DEFAULTS };
  try {
    const rows = await db.select().from(geoSystemConfig).where(eq(geoSystemConfig.id, 1)).limit(1);
    const row = rows[0];
    if (!row) return { ...GEO_SYSTEM_ANNOUNCEMENT_DEFAULTS };
    return announcementFromRow(row);
  } catch {
    return { ...GEO_SYSTEM_ANNOUNCEMENT_DEFAULTS };
  }
}

export function invalidateGeoSystemConfigCache(): void {
  cached = null;
}

export async function loadGeoSystemConfig(): Promise<GeoSystemConfigSnapshot> {
  if (cached) return cached;

  const envOverrides = readEnvOverrides();
  const db = await getDb();

  if (db) {
    try {
      const rows = await db.select().from(geoSystemConfig).where(eq(geoSystemConfig.id, 1)).limit(1);
      const row = rows[0];
      if (row) {
        const values = rowToValues(row);
        const merged = {
          ...GEO_SYSTEM_CONFIG_DEFAULTS,
          ...values,
          ...envOverrides,
        };
        applySyncValues(merged);
        cached = mergeConfig(
          merged,
          envOverrides.source ?? "database",
          row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
        );
        return cached;
      }
    } catch (error) {
      console.warn("[geoSystemConfig] Failed to read database row:", error);
    }
  }

  const merged = {
    ...GEO_SYSTEM_CONFIG_DEFAULTS,
    ...envOverrides,
  };
  applySyncValues(merged);
  cached = mergeConfig(merged, envOverrides.source ?? "default", null);
  return cached;
}

export async function saveGeoSystemConfig(
  input: GeoSystemConfigRunParams,
  updatedByUserId: number,
): Promise<GeoSystemConfigSnapshot> {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库不可用，无法保存系统配置");
  }

  const announcement = await readAnnouncementFromDb();

  const payload = {
    id: 1,
    contentGenerationPerMinuteLimit: input.contentGenerationPerMinuteLimit,
    t0DetectionPerHourLimit: input.t0DetectionPerHourLimit,
    qualityMinPassScore: input.qualityMinPassScore,
    defaultPublishPlatforms: input.defaultPublishPlatforms,
    systemAnnouncementEnabled: announcement.enabled ? 1 : 0,
    systemAnnouncementBody: announcement.body.trim() ? announcement.body : null,
    systemAnnouncementUpdatedAt: announcement.versionKey ? new Date(announcement.versionKey) : null,
    updatedByUserId,
  };

  const existing = await db.select().from(geoSystemConfig).where(eq(geoSystemConfig.id, 1)).limit(1);
  if (existing[0]) {
    await db.update(geoSystemConfig).set(payload).where(eq(geoSystemConfig.id, 1));
  } else {
    await db.insert(geoSystemConfig).values(payload);
  }

  invalidateGeoSystemConfigCache();
  return loadGeoSystemConfig();
}

export async function saveSystemAnnouncement(
  input: { enabled: boolean; body: string },
  updatedByUserId: number,
): Promise<GeoSystemConfigSnapshot> {
  const db = await getDb();
  if (!db) {
    throw new Error("数据库不可用，无法保存系统公告");
  }

  const trimmedBody = input.body.trim();
  const now = new Date();
  const announcement: SystemAnnouncementPublic = {
    enabled: input.enabled,
    body: trimmedBody,
    versionKey: input.enabled && trimmedBody ? now.toISOString() : null,
  };

  const existing = await db.select().from(geoSystemConfig).where(eq(geoSystemConfig.id, 1)).limit(1);
  const row = existing[0];

  if (row) {
    await db
      .update(geoSystemConfig)
      .set({
        systemAnnouncementEnabled: announcement.enabled ? 1 : 0,
        systemAnnouncementBody: announcement.body || null,
        systemAnnouncementUpdatedAt: announcement.versionKey ? now : null,
        updatedByUserId,
      })
      .where(eq(geoSystemConfig.id, 1));
  } else {
    const defaults = GEO_SYSTEM_CONFIG_DEFAULTS;
    await db.insert(geoSystemConfig).values({
      id: 1,
      contentGenerationPerMinuteLimit: defaults.contentGenerationPerMinuteLimit,
      t0DetectionPerHourLimit: defaults.t0DetectionPerHourLimit,
      qualityMinPassScore: defaults.qualityMinPassScore,
      defaultPublishPlatforms: [...defaults.defaultPublishPlatforms],
      systemAnnouncementEnabled: announcement.enabled ? 1 : 0,
      systemAnnouncementBody: announcement.body || null,
      systemAnnouncementUpdatedAt: announcement.versionKey ? now : null,
      updatedByUserId,
    });
  }

  invalidateGeoSystemConfigCache();
  return loadGeoSystemConfig();
}

export async function loadSystemAnnouncementPublic(): Promise<SystemAnnouncementPublic> {
  const cfg = await loadGeoSystemConfig();
  return cfg.systemAnnouncement;
}

export async function getContentGenerationRateLimitConfig(): Promise<RateLimitConfig> {
  const cfg = await loadGeoSystemConfig();
  return {
    windowMs: 60_000,
    maxRequests: cfg.contentGenerationPerMinuteLimit,
  };
}

export async function getT0DetectionRateLimitConfig(): Promise<RateLimitConfig> {
  const cfg = await loadGeoSystemConfig();
  return {
    windowMs: 60 * 60_000,
    maxRequests: cfg.t0DetectionPerHourLimit,
  };
}

export async function getQualityMinPassScore(): Promise<number> {
  const cfg = await loadGeoSystemConfig();
  return cfg.qualityMinPassScore;
}

export async function getDefaultPublishPlatforms(): Promise<string[]> {
  const cfg = await loadGeoSystemConfig();
  return cfg.defaultPublishPlatforms;
}
