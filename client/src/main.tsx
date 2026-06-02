import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import {
  GENERIC_FORBIDDEN_MESSAGE,
  GENERIC_SERVER_ERROR_MESSAGE,
  GENERIC_SERVICE_UNAVAILABLE_MESSAGE,
  looksLikeInternalTechnicalError,
  toUserFacingErrorFromUnknown,
} from "@shared/userFacingErrors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { nukeStaleProjectContextCache } from "@/lib/projectContextCache";
import "./index.css";

nukeStaleProjectContextCache();

const queryClient = new QueryClient();
const TOAST_DEDUP_MS = 2_000;
let lastErrorToast = { key: "", at: 0 };

function errorCodeOf(error: unknown): string | null {
  if (!(error instanceof TRPCClientError)) return null;
  return typeof error.data?.code === "string" ? error.data.code : null;
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = errorCodeOf(error) === "UNAUTHORIZED" || error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  const loginUrl = getLoginUrl();
  if (loginUrl) window.location.href = loginUrl;
};

function shouldToastError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) return false;
  return errorCodeOf(error) !== "UNAUTHORIZED";
}

function toastGlobalError(error: unknown) {
  if (!shouldToastError(error)) return;
  const code = errorCodeOf(error);
  const message =
    code === "FORBIDDEN"
      ? GENERIC_FORBIDDEN_MESSAGE
      : code === "INTERNAL_SERVER_ERROR"
        ? GENERIC_SERVER_ERROR_MESSAGE
        : code === "TIMEOUT"
          ? GENERIC_SERVICE_UNAVAILABLE_MESSAGE
          : toUserFacingErrorFromUnknown(error);
  const key = `${code ?? "unknown"}:${message}`;
  const now = Date.now();
  if (lastErrorToast.key === key && now - lastErrorToast.at < TOAST_DEDUP_MS) return;
  lastErrorToast = { key, at: now };
  toast.error(message);
}

function shouldLogTrpcCacheError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) return true;
  if (error.message === UNAUTHED_ERR_MSG) return false;
  return !looksLikeInternalTechnicalError(error.message);
}

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    toastGlobalError(error);
    if (shouldLogTrpcCacheError(error)) {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    toastGlobalError(error);
    if (shouldLogTrpcCacheError(error)) {
      console.error("[API Mutation Error]", error);
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
