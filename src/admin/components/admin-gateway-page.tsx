import { AdminPageHeader } from "./admin-page-header";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { cn } from "../lib/utils";

interface GatewayStatus {
  status: string;
  sessionId: string | null;
  resumeGatewayUrl: string | null;
  lastSequence: number | null;
  backoffAttempt: number;
  lastError: string | null;
  heartbeatIntervalMs: number | null;
}

export function AdminGatewayPage({
  gatewayStatus,
  gatewayError,
  onStartGateway,
  onRefresh,
}: {
  gatewayStatus: GatewayStatus | null;
  gatewayError: string | null;
  onStartGateway: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Gateway"
        description="Start the session and inspect live telemetry from the Discord gateway."
      />
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void onStartGateway()}>Start gateway</Button>
            <Button variant="outline" onClick={() => void onRefresh()}>
              Refresh dashboard
            </Button>
          </div>
          {gatewayError ? (
            <Alert variant="destructive">
              <AlertDescription>{gatewayError}</AlertDescription>
            </Alert>
          ) : null}
          {gatewayStatus ? (
            <GatewayDetails status={gatewayStatus} />
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5">
              <p className="text-xs font-medium text-muted-foreground">Current state</p>
              <p className="mt-2 text-sm text-muted-foreground">Loading gateway status...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function GatewayDetails({ status }: { status: GatewayStatus }) {
  const details = [
    ["Session ID", status.sessionId ?? "Not established"],
    ["Last sequence", status.lastSequence ?? "None"],
    ["Heartbeat interval", formatHeartbeatInterval(status.heartbeatIntervalMs)],
    ["Backoff attempt", String(status.backoffAttempt)],
    ["Resume URL", status.resumeGatewayUrl ?? "Default gateway URL"],
    ["Last error", status.lastError ?? "None"],
  ] satisfies Array<[string, string | number]>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Current state</span>
        <StatusBadge status={status.status} />
        <p className="text-sm text-muted-foreground">
          {status.lastError
            ? "The gateway reported an error. Review the details below."
            : "Session telemetry is available and up to date."}
        </p>
      </div>
      <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-background p-4">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-sm font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = getStatusTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
        tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-100",
        tone === "danger" && "border-destructive/40 bg-destructive/10 text-destructive-foreground",
        tone === "neutral" && "border-border bg-muted/40 text-foreground"
      )}
    >
      {status}
    </span>
  );
}

type StatusTone = "success" | "warning" | "danger" | "neutral";

function getStatusTone(status: string | null): StatusTone {
  if (!status) {
    return "neutral";
  }

  const normalized = status.toLowerCase();
  if (normalized.includes("ready") || normalized.includes("connected") || normalized.includes("active")) {
    return "success";
  }

  if (normalized.includes("error") || normalized.includes("fail") || normalized.includes("closed")) {
    return "danger";
  }

  if (normalized.includes("backoff") || normalized.includes("start") || normalized.includes("connect")) {
    return "warning";
  }

  return "neutral";
}

function formatHeartbeatInterval(intervalMs: number | null): string {
  if (intervalMs === null) {
    return "Unknown";
  }

  return `${Math.round(intervalMs / 1000)}s`;
}
