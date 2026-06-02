import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateProject,
  clearActiveProjectId,
  getActiveProjectId,
  getActiveProjectIdFromStorage,
  inspectActiveProjectContext,
  resolveActiveProjectId,
  setActiveProjectId,
} from "../client/src/lib/activeProject";

const projects = [{ id: 72 }, { id: 88 }];

function installSessionStorageMock(initialSearch = "") {
  const store: Record<string, string> = {};
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  });
  vi.stubGlobal("window", {
    location: { search: initialSearch },
  });
  return store;
}

describe("GEO-V1.1-ActiveProjectIdFix activeProject", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installSessionStorageMock();
    clearActiveProjectId();
  });

  it("sessionStorage 存旧 ID 30001 时 inspect 标记 stale 并 fallback 到第一个有效项目", () => {
    setActiveProjectId(30001);
    const result = inspectActiveProjectContext(projects);
    expect(result.contextId).toBe(30001);
    expect(result.staleContext).toBe(true);
    expect(result.projectId).toBe(72);
  });

  it("resolveActiveProjectId 清除脏缓存并写入 fallback", () => {
    setActiveProjectId(30001);
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
    setActiveProjectId(30001);
    const result = inspectActiveProjectContext(projects, { search: "?projectId=72" });
    expect(result.staleContext).toBe(false);
    expect(result.projectId).toBe(72);
  });
});
