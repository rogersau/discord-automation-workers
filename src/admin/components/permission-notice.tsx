import { useEffect, useState } from "react";

import type {
  AdminPermissionCheck,
  AdminPermissionCheckResponse,
  AdminPermissionFeature,
} from "../../runtime/admin-types";
import { Alert, AlertDescription } from "./ui/alert";

type PermissionNoticeState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; checks: AdminPermissionCheck[] }
  | { kind: "error"; message: string };

export function PermissionNotice({
  selectedGuildId,
  feature,
}: {
  selectedGuildId: string;
  feature: AdminPermissionFeature;
}) {
  const trimmedGuildId = selectedGuildId.trim();
  const [state, setState] = useState<PermissionNoticeState>({ kind: "idle" });

  useEffect(() => {
    if (!trimmedGuildId) {
      setState({ kind: "idle" });
      return;
    }

    let cancelled = false;
    const requestPath =
      `/admin/api/permissions?guildId=${encodeURIComponent(trimmedGuildId)}` +
      `&feature=${encodeURIComponent(feature)}`;

    setState({ kind: "loading" });

    void (async () => {
      try {
        const response = await fetch(requestPath);
        const body = (await response.json()) as AdminPermissionCheckResponse & { error?: string };
        if (!response.ok) {
          throw new Error(body.error ?? `Permission check failed (${response.status})`);
        }
        if (!cancelled) {
          setState({ kind: "ready", checks: body.checks });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "Failed to load permission checks.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [feature, trimmedGuildId]);

  return (
    <Alert className="border-amber-500/30 bg-amber-500/10">
      <AlertDescription className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Permission check</p>
          <p className="text-sm text-muted-foreground">
            {state.kind === "idle"
              ? "Select a server to run a live Discord permission check."
              : state.kind === "loading"
                ? "Checking the bot's current Discord permissions for this server."
                : state.kind === "error"
                  ? state.message
                  : state.checks.length === 0
                    ? "No live Discord permission issues were found for this feature."
                    : "Live Discord permission results for the selected server."}
          </p>
        </div>
        {state.kind === "ready" && state.checks.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {state.checks.map((check) => (
                <span
                  key={check.label}
                  className={getBadgeClassName(check.status)}
                >
                  {check.label}
                </span>
              ))}
            </div>
            <div className="space-y-1">
              {state.checks.map((check) => (
                <p key={`${check.label}:detail`} className="text-sm text-muted-foreground">
                  {check.detail}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function getBadgeClassName(status: AdminPermissionCheck["status"]) {
  if (status === "ok") {
    return "rounded-md border border-emerald-500/30 bg-background/60 px-2.5 py-1 text-xs font-medium text-emerald-200";
  }

  if (status === "error") {
    return "rounded-md border border-red-500/30 bg-background/60 px-2.5 py-1 text-xs font-medium text-red-200";
  }

  return "rounded-md border border-amber-500/30 bg-background/60 px-2.5 py-1 text-xs font-medium text-amber-100";
}
