import { Button } from "@/components/ui/button";
import type { HealthResponse } from "@shared/health";
import { useCallback, useEffect, useState } from "react";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: HealthResponse; httpOk: boolean };

function StatusIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-block h-3 w-3 shrink-0 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
        aria-hidden
      />
      <span className={`font-medium ${ok ? "text-green-700" : "text-red-700"}`}>{label}</span>
      <span className="text-sm text-gray-500">{ok ? "正常" : "异常"}</span>
    </div>
  );
}

function formatHealthTimestamp(at?: string) {
  if (!at) return null;
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return at;
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

export default function SystemStatusPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as HealthResponse;
      setState({ kind: "ready", data, httpOk: res.ok });
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法连接 API";
      setState({ kind: "error", message });
    }
  }, []);

  useEffect(() => {
    document.title = "系统状态 - GEO";
    void load();
  }, [load]);

  const apiOk = state.kind === "ready" && state.httpOk && state.data.api.ok;
  const db =
    state.kind === "ready"
      ? state.data.database
      : { ok: false, message: state.kind === "error" ? state.message : undefined };
  const llm = state.kind === "ready" ? state.data.llm : { ok: false };
  const operations =
    state.kind === "ready"
      ? state.data.operations
      : {
          lastContentGeneration: { ok: false, message: state.kind === "error" ? state.message : undefined },
          lastPublish: { ok: false },
          queueTaskCount: 0,
          queueAvailable: false,
        };
  const version = state.kind === "ready" ? state.data.version : "—";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 font-mono text-sm text-slate-900">
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">系统状态</h1>
            <p className="mt-1 text-xs text-slate-500">技术人员诊断页 · 无需登录</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={state.kind === "loading"}>
            刷新
          </Button>
        </div>

        {state.kind === "loading" ? (
          <p className="text-slate-500">检查中…</p>
        ) : (
          <ul className="space-y-4">
            <li>
              <StatusIndicator ok={apiOk} label="API 服务" />
              {state.kind === "error" ? (
                <p className="mt-1 pl-6 text-xs text-red-600">{state.message}</p>
              ) : null}
            </li>
            <li>
              <StatusIndicator ok={db.ok} label="数据库连接" />
              {db.message ? <p className="mt-1 pl-6 text-xs text-slate-600">{db.message}</p> : null}
            </li>
            <li>
              <StatusIndicator ok={llm.ok} label="AI 模型服务" />
              {llm.provider ? (
                <p className="mt-1 pl-6 text-xs text-slate-600">
                  {llm.provider}
                  {llm.model ? ` · ${llm.model}` : ""}
                </p>
              ) : null}
              {llm.message ? <p className="mt-1 pl-6 text-xs text-slate-600">{llm.message}</p> : null}
            </li>
            <li className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">业务运行状态</p>
              <ul className="space-y-4">
                <li>
                  <StatusIndicator ok={operations.lastContentGeneration.ok} label="最近内容生成" />
                  {operations.lastContentGeneration.at ? (
                    <p className="mt-1 pl-6 text-xs text-slate-600">
                      时间：{formatHealthTimestamp(operations.lastContentGeneration.at)}
                    </p>
                  ) : null}
                  {operations.lastContentGeneration.message ? (
                    <p className="mt-1 pl-6 text-xs text-slate-600">{operations.lastContentGeneration.message}</p>
                  ) : null}
                </li>
                <li>
                  <StatusIndicator ok={operations.lastPublish.ok} label="最近发布" />
                  {operations.lastPublish.at ? (
                    <p className="mt-1 pl-6 text-xs text-slate-600">
                      时间：{formatHealthTimestamp(operations.lastPublish.at)}
                    </p>
                  ) : null}
                  {operations.lastPublish.message ? (
                    <p className="mt-1 pl-6 text-xs text-slate-600">{operations.lastPublish.message}</p>
                  ) : null}
                </li>
                <li>
                  <p className="text-slate-700">
                    <span className="font-medium">发布队列任务数：</span>
                    {operations.queueAvailable ? (
                      <span className="font-semibold tabular-nums">{operations.queueTaskCount}</span>
                    ) : (
                      <span className="text-red-600">不可用</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">统计 pending / agent_processing 等非终态任务</p>
                </li>
              </ul>
            </li>
            <li className="border-t border-slate-100 pt-4">
              <p className="text-slate-700">
                <span className="text-slate-500">当前版本：</span>
                <span className="font-semibold">v{version}</span>
              </p>
            </li>
          </ul>
        )}

        {state.kind === "ready" ? (
          <p className="mt-6 text-xs text-slate-400">
            综合状态：{state.data.ok ? "全部通过" : "存在异常"} · HTTP {state.httpOk ? "200" : "503"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
