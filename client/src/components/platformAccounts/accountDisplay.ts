import { isPendingAccountDisplayName } from "@shared/localAgentAccountSync";
import type { AccountRow } from "./types";

export function sessionTone(status: string | null): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "expired") return "warning";
  return "neutral";
}

export function sessionLabel(status: string | null): string {
  if (status === "active") return "登录有效";
  if (status === "expired") return "登录失效";
  return "未检测";
}

export function verificationTone(status: string): "success" | "warning" | "neutral" {
  if (status === "verified" || status === "matched") return "success";
  if (status === "failed" || status === "mismatched") return "warning";
  return "neutral";
}

export function verificationLabel(status: string): string {
  if (status === "verified" || status === "matched") return "已验证";
  if (status === "failed" || status === "mismatched") return "验证失败";
  return "未验证";
}

export function formatTime(value: Date | string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("zh-CN");
}

export function displayAccountName(row: AccountRow): string {
  const name = row.accountName?.trim();
  if (name && !isPendingAccountDisplayName(name)) return name;
  if (row.sessionStatus === "active") return "账号已登录";
  return "未检测到昵称";
}

export function lastPublishDisplay(row: AccountRow): string {
  return row.lastLoginAt ? formatTime(row.lastLoginAt) : "暂无";
}
