import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGACY_ORPHAN_PROJECT_ID } from "@shared/const";
import {
  activateProject,
  buildProjectUrl,
  clearActiveProjectId,
  getActiveProjectId,
  getActiveProjectIdFromStorage,
  getProjectIdFromSearch,
  inspectActiveProjectContext,
  isProjectIdAccessible,
  resolveActiveProjectId,
  setActiveProjectId,
} from "../client/src/lib/activeProject";
import {
  nukeStaleProjectContextCache,
  PROJECT_CONTEXT_CACHE_VERSION,
  stripLegacyOrphanProjectIdFromUrl,
} from "../client/src/lib/projectContextCache";

const projects = [{ id: 72 }, { id: 88 }];

function installSessionStorageMock(initialSearch = "") {
  const sessionStore: Record<string, string> = {};
  const localStore: Record<string, string> = {};
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => sessionStore[key] ?? null,
    setItem: (key: string, value: string) => {
      sessionStore[key] = value;
    },
    removeItem: (key: string) => {
      delete sessionStore[key];
    },
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => localStore[key] ?? null,
    setItem: (key: string, value: string) => {
      localStore[key] = value;
    },
    removeItem: (key: string) => {
      delete localStore[key];
    },
  });
  vi.stubGlobal("window", {
    location: {
      search: initialSearch,
      pathname: "/workspace",
      href: `http://localhost/workspace${initialSearch}`,
    },
    history: { replaceState: vi.fn() },
  });
  return { sessionStore, localStore };
}

describe("GEO-V1.1-ActiveProjectIdFix activeProject", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installSessionStorageMock();
    clearActiveProjectId();
  });

  it("禁止通过 setActiveProjectId 写入 30001", () => {
    setActiveProjectId(LEGACY_ORPHAN_PROJECT_ID);
    expect(getActiveProjectIdFromStorage()).toBeNull();
  });

  it("session 残留 30001 时被忽略，不进入 stale 解析", () => {
    const { sessionStore } = installSessionStorageMock();
    sessionStore.activeProjectId = String(LEGACY_ORPHAN_PROJECT_ID);
    const result = inspectActiveProjectContext(projects);
    expect(result.contextId).toBeNull();
    expect(result.staleContext).toBe(false);
    expect(result.projectId).toBeNull();
  });

  it("列表首项为 30001 时 fallback 到下一个可导航项目", () => {
    const orphanFirst = [{ id: LEGACY_ORPHAN_PROJECT_ID }, { id: 72 }, { id: 88 }];
    setActiveProjectId(30002);
    const result = inspectActiveProjectContext(orphanFirst);
    expect(result.staleContext).toBe(true);
    expect(result.projectId).toBe(72);
  });

  it("不可访问的非孤儿 projectId 仍标记 stale 并 fallback", () => {
    setActiveProjectId(30002);
    const result = inspectActiveProjectContext(projects);
    expect(result.contextId).toBe(30002);
    expect(result.staleContext).toBe(true);
    expect(result.projectId).toBe(72);
  });

  it("resolveActiveProjectId 对不可访问 ID 清除脏缓存并写入 fallback", () => {
    setActiveProjectId(30002);
    const result = resolveActiveProjectId(projects);
    expect(result.staleContext).toBe(true);
    expect(result.projectId).toBe(72);
    expect(getActiveProjectIdFromStorage()).toBe(72);
  });

  it("activateProject 显式写入真实 ID", () => {
    const id = activateProject(72);
    expect(id).toBe(72);
    expect(getActiveProjectId()).toBe(72);
  });

  it("URL projectId 优先于 sessionStorage", () => {
    installSessionStorageMock("?projectId=72");
    setActiveProjectId(LEGACY_ORPHAN_PROJECT_ID);
    const result = inspectActiveProjectContext(projects, { search: "?projectId=72" });
    expect(result.staleContext).toBe(false);
    expect(result.projectId).toBe(72);
  });

  it("buildProjectUrl 保留路径上的额外查询参数", () => {
    expect(buildProjectUrl("/enterprise-profile?step=6", 42)).toBe("/enterprise-profile?step=6&projectId=42");
  });

  it("buildProjectUrl 与 isProjectIdAccessible 拒绝 30001", () => {
    expect(buildProjectUrl("/workspace", LEGACY_ORPHAN_PROJECT_ID)).toBe("/workspace");
    expect(isProjectIdAccessible(LEGACY_ORPHAN_PROJECT_ID, [{ id: LEGACY_ORPHAN_PROJECT_ID }])).toBe(
      false,
    );
  });

  it("getActiveProjectId 与 URL 解析忽略 30001", () => {
    installSessionStorageMock("?projectId=30001");
    setActiveProjectId(LEGACY_ORPHAN_PROJECT_ID);
    expect(getActiveProjectId()).toBeNull();
    expect(getProjectIdFromSearch("?projectId=30001")).toBeNull();
  });
});

describe("GEO-V1.1-CacheNuke projectContextCache", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installSessionStorageMock();
  });

  it("旧 cacheVersion 升级 v2 时清除 session activeProjectId", () => {
    const { sessionStore, localStore } = installSessionStorageMock();
    sessionStore.activeProjectId = String(LEGACY_ORPHAN_PROJECT_ID);
    localStore.geoProjectContextCacheVersion = "v1";
    const result = nukeStaleProjectContextCache();
    expect(result.nuked).toBe(true);
    expect(result.reasons).toContain("cache_version_upgrade");
    expect(sessionStore.activeProjectId).toBeUndefined();
    expect(localStore.geoProjectContextCacheVersion).toBe(PROJECT_CONTEXT_CACHE_VERSION);
  });

  it("stripLegacyOrphanProjectIdFromUrl 移除地址栏 30001", () => {
    installSessionStorageMock("?projectId=30001");
    const replaced = stripLegacyOrphanProjectIdFromUrl();
    expect(replaced).toBe(true);
    expect(window.history.replaceState).toHaveBeenCalled();
  });
});
