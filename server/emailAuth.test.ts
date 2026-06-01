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
    expect(routers).toContain("updateProfile:");
    expect(routers).toContain("changePassword:");
  });

  it("settings page route exists", () => {
    const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
    expect(app).toContain('path="/settings"');
    expect(fs.existsSync(path.join(root, "client/src/pages/SettingsPage.tsx"))).toBe(true);
  });

  it("top bar links to settings", () => {
    const topBar = fs.readFileSync(path.join(root, "client/src/components/clients/ClientsHubTopBar.tsx"), "utf8");
    expect(topBar).toContain("/settings");
  });

  it("register page route exists", () => {
    const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
    expect(app).toContain('path="/register"');
    expect(fs.existsSync(path.join(root, "client/src/pages/RegisterPage.tsx"))).toBe(true);
  });

  it("dashboard layout delegates to login gate panel", () => {
    const layout = fs.readFileSync(path.join(root, "client/src/components/DashboardLayout.tsx"), "utf8");
    expect(layout).toContain("LoginGatePanel");
  });

  it("login panel links to register and landing", () => {
    const login = fs.readFileSync(path.join(root, "client/src/components/auth/LoginGatePanel.tsx"), "utf8");
    expect(login).toContain("还没有账号");
    expect(login).toContain("/register");
    expect(login).toContain("了解更多");
    expect(login).toContain("/landing");
  });

  it("landing page route exists", () => {
    const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
    expect(app).toContain('path="/landing"');
    expect(fs.existsSync(path.join(root, "client/src/pages/LandingPage.tsx"))).toBe(true);
  });

  it("login page uses split marketing layout and forgot password", () => {
    const login = fs.readFileSync(path.join(root, "client/src/components/auth/LoginGatePanel.tsx"), "utf8");
    const marketing = fs.readFileSync(path.join(root, "client/src/components/auth/authMarketing.ts"), "utf8");
    const forgot = fs.readFileSync(
      path.join(root, "client/src/components/auth/ForgotPasswordDialog.tsx"),
      "utf8",
    );
    expect(login).toContain("AuthPageLayout");
    expect(login).toContain("ForgotPasswordLink");
    expect(login).toContain("toEmailLoginErrorMessage");
    expect(marketing).toContain("AUTH_PRODUCT_SELLING_POINTS");
    expect(forgot).toContain("forgot-password-link");
    expect(forgot).toContain("请联系管理员重置密码");
  });

  it("register page uses split marketing layout", () => {
    const register = fs.readFileSync(path.join(root, "client/src/pages/RegisterPage.tsx"), "utf8");
    expect(register).toContain("AuthPageLayout");
  });

  it("login failures use friendly credentials copy", () => {
    const emailAuth = fs.readFileSync(path.join(root, "server/emailAuth.ts"), "utf8");
    expect(emailAuth).toContain("邮箱或密码错误");
    const mapper = fs.readFileSync(path.join(root, "shared/emailLoginErrors.ts"), "utf8");
    expect(mapper).toContain("EMAIL_LOGIN_INVALID_CREDENTIALS");
  });
});
