import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { assertPasswordStrength, hashPassword, normalizeEmail, verifyPassword } from "./passwordAuth";

const root = path.resolve(import.meta.dirname, "..");

describe("GEO-V1.1 email registration auth", () => {
  it("password scrypt hash roundtrip", async () => {
    const hash = await hashPassword("test-password-123");
    expect(hash.startsWith("scrypt:")).toBe(true);
    await expect(verifyPassword("test-password-123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("rejects password shorter than 8", () => {
    expect(() => assertPasswordStrength("short")).toThrow(/8/);
  });

  it("normalizes email", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("auth router exposes register and loginWithEmail", () => {
    const routers = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
    expect(routers).toContain("register:");
    expect(routers).toContain("loginWithEmail:");
    expect(routers).toContain("registerEmailUser");
  });

  it("register page route exists", () => {
    const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
    expect(app).toContain('path="/register"');
    expect(fs.existsSync(path.join(root, "client/src/pages/RegisterPage.tsx"))).toBe(true);
  });

  it("login panel links to register", () => {
    const layout = fs.readFileSync(path.join(root, "client/src/components/DashboardLayout.tsx"), "utf8");
    expect(layout).toContain("还没有账号");
    expect(layout).toContain("/register");
  });
});
