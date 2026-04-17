import { useCallback, useEffect, useRef, useState } from "react";
import {
  startGatewayStatusMonitor,
  type GatewayStatusMonitor,
} from "../admin-gateway-monitor";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";

interface GatewayStatus {
  status: string;
  sessionId: string | null;
  resumeGatewayUrl: string | null;
  lastSequence: number | null;
  backoffAttempt: number;
  lastError: string | null;
  heartbeatIntervalMs: number | null;
}

interface TimedRoleAssignment {
  guildId: string;
  userId: string;
  roleId: string;
  durationInput: string;
  expiresAtMs: number;
}

interface AdminOverviewGuild {
  guildId: string;
  emojis: string[];
  timedRoles: TimedRoleAssignment[];
}

interface AdminOverview {
  gateway: GatewayStatus;
  guilds: AdminOverviewGuild[];
}

interface Props {
  initialAuthenticated?: boolean;
}

export default function App({ initialAuthenticated = false }: Props) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const gatewayMonitorRef = useRef<GatewayStatusMonitor | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const nextOverview = await readJsonOrThrow<AdminOverview>("/admin/api/overview");
      setOverview(nextOverview);
      setOverviewError(null);
      setGatewayStatus(nextOverview.gateway);
      setGatewayError(null);
    } catch (error) {
      setOverviewError(describeError(error));
    }
  }, []);

  useEffect(() => {
    if (!authenticated) {
      gatewayMonitorRef.current = null;
      setGatewayStatus(null);
      setOverview(null);
      setGatewayError(null);
      setOverviewError(null);
      return;
    }

    let cancelled = false;
    void loadOverview().catch(() => undefined);

    const monitor = startGatewayStatusMonitor({
      intervalMs: 2000,
      loadStatus() {
        return readJsonOrThrow<GatewayStatus>("/admin/api/gateway/status");
      },
      onStatus(status) {
        if (cancelled) {
          return;
        }
        setGatewayStatus(status);
        setGatewayError(null);
      },
      onError(error) {
        if (cancelled) {
          return;
        }
        setGatewayError(describeError(error));
      },
      setInterval(callback, delayMs) {
        return window.setInterval(callback, delayMs);
      },
      clearInterval(timer) {
        window.clearInterval(timer as number);
      },
    });
    gatewayMonitorRef.current = monitor;

    return () => {
      cancelled = true;
      gatewayMonitorRef.current = null;
      monitor.stop();
    };
  }, [authenticated, loadOverview]);

  async function handleLogin() {
    setLoginError(false);
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `password=${encodeURIComponent(password)}`,
      redirect: "follow",
    });
    if (res.ok || res.redirected) {
      setAuthenticated(true);
    } else {
      setLoginError(true);
    }
  }

  async function handleGatewayStart() {
    await readJsonOrThrow("/admin/api/gateway/start", { method: "POST" });
    await Promise.all([gatewayMonitorRef.current?.refresh(), loadOverview()]);
  }

  if (authenticated) {
    return (
      <main className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Button
            variant="outline"
            onClick={async () => {
              await fetch("/admin/logout", { method: "POST" });
              window.location.href = "/admin/login";
            }}
          >
            Sign out
          </Button>
        </div>

        <section>
          <h2 className="text-xl font-semibold mb-2">Gateway</h2>
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={handleGatewayStart}>Start gateway</Button>
                <Button size="sm" variant="outline" onClick={() => void loadOverview()}>
                  Refresh dashboard
                </Button>
              </div>
              {gatewayError && <p className="text-sm text-red-600">{gatewayError}</p>}
              {gatewayStatus ? (
                <GatewayDetails status={gatewayStatus} />
              ) : (
                <p>Loading gateway status…</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Stored Server Data</h2>
          <Card>
            <CardContent className="pt-4 space-y-4">
              {overviewError && <p className="text-sm text-red-600">{overviewError}</p>}
              {overview ? (
                overview.guilds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No blocklists or timed roles are stored yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {overview.guilds.map((guild) => (
                      <GuildOverviewCard key={guild.guildId} guild={guild} />
                    ))}
                  </div>
                )
              ) : (
                <p>Loading stored server data…</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Blocklist</h2>
          <Card>
            <CardContent className="pt-4">
              <BlocklistEditor onUpdated={loadOverview} />
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Timed Roles</h2>
          <Card>
            <CardContent className="pt-4">
              <TimedRolesEditor onUpdated={loadOverview} />
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin password"
              />
            </div>
            <Button className="w-full" onClick={handleLogin}>
              Sign in
            </Button>
            {loginError && (
              <p className="text-sm text-red-600 text-center">Incorrect password. Please try again.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function GatewayDetails({ status }: { status: GatewayStatus }) {
  return (
    <div className="grid gap-2 text-sm">
      <p>Status: <strong>{status.status}</strong></p>
      <p>Session ID: {status.sessionId ?? "Not established"}</p>
      <p>Last sequence: {status.lastSequence ?? "None"}</p>
      <p>Heartbeat interval: {formatHeartbeatInterval(status.heartbeatIntervalMs)}</p>
      <p>Backoff attempt: {status.backoffAttempt}</p>
      <p>Resume URL: {status.resumeGatewayUrl ?? "Default gateway URL"}</p>
      <p>Last error: {status.lastError ?? "None"}</p>
    </div>
  );
}

function GuildOverviewCard({ guild }: { guild: AdminOverviewGuild }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h3 className="font-semibold">{guild.guildId}</h3>
        <p className="text-sm text-muted-foreground">
          Blocked emojis: {guild.emojis.length === 0 ? "None" : guild.emojis.join(" ")}
        </p>
      </div>
      {guild.timedRoles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No timed roles are active in this guild.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guild.timedRoles.map((assignment) => (
              <TableRow key={`${assignment.guildId}:${assignment.userId}:${assignment.roleId}`}>
                <TableCell>{assignment.userId}</TableCell>
                <TableCell>{assignment.roleId}</TableCell>
                <TableCell>{assignment.durationInput}</TableCell>
                <TableCell>{new Date(assignment.expiresAtMs).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function BlocklistEditor({ onUpdated }: { onUpdated: () => Promise<void> }) {
  const [guildId, setGuildId] = useState("");
  const [emoji, setEmoji] = useState("");
  const [action, setAction] = useState<"add" | "remove">("add");
  const [currentEmojis, setCurrentEmojis] = useState<string[] | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const trimmedGuildId = guildId.trim();

  async function loadBlocklist(id: string) {
    const normalizedGuildId = id.trim();
    if (!normalizedGuildId) { setCurrentEmojis(null); return; }
    try {
      const res = await fetch(`/admin/api/blocklist?guildId=${encodeURIComponent(normalizedGuildId)}`);
      if (res.ok) {
        const data = await res.json() as { emojis: string[] };
        setCurrentEmojis(data.emojis);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit() {
    const res = await fetch("/admin/api/blocklist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guildId, emoji, action }),
    });
    if (res.ok) {
      const data = await res.json() as { guilds: Record<string, { emojis: string[] }> };
      setCurrentEmojis(data.guilds?.[guildId]?.emojis ?? null);
      setResult(`${action === "add" ? "Blocked" : "Unblocked"} ${emoji} in ${guildId}`);
      await onUpdated();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="bl-guild">Guild ID</Label>
          <Input
            id="bl-guild"
            value={guildId}
            onChange={(e) => { setGuildId(e.target.value); setCurrentEmojis(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void loadBlocklist(guildId);
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bl-emoji">Emoji</Label>
          <Input id="bl-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Action</Label>
          <div className="flex gap-1">
            <Button size="sm" variant={action === "add" ? "default" : "outline"} onClick={() => setAction("add")}>Add</Button>
            <Button size="sm" variant={action === "remove" ? "default" : "outline"} onClick={() => setAction("remove")}>Remove</Button>
          </div>
        </div>
        <Button size="sm" variant="outline" disabled={!trimmedGuildId} onClick={() => void loadBlocklist(guildId)}>Load blocklist</Button>
        <Button size="sm" onClick={handleSubmit}>Apply</Button>
      </div>
      {currentEmojis !== null && (
        <p className="text-sm text-muted-foreground">
          {currentEmojis.length === 0
            ? "No emojis currently blocked in this guild."
            : `Currently blocked: ${currentEmojis.join(" ")}`}
        </p>
      )}
      {result && <p className="text-sm">{result}</p>}
    </div>
  );
}

function TimedRolesEditor({ onUpdated }: { onUpdated: () => Promise<void> }) {
  const [guildId, setGuildId] = useState("");
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [duration, setDuration] = useState("1h");
  const [assignments, setAssignments] = useState<TimedRoleAssignment[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trimmedGuildId = guildId.trim();

  async function loadAssignments(nextGuildId: string) {
    const trimmedGuildId = nextGuildId.trim();
    setMessage(null);
    setError(null);

    if (!trimmedGuildId) {
      setAssignments(null);
      return;
    }

    const res = await fetch(`/admin/api/timed-roles?guildId=${encodeURIComponent(trimmedGuildId)}`);
    if (!res.ok) {
      setError("Failed to load timed roles.");
      return;
    }

    const data = await res.json() as { assignments: TimedRoleAssignment[] };
    setAssignments(data.assignments);
  }

  async function handleAdd() {
    setMessage(null);
    setError(null);

    const res = await fetch("/admin/api/timed-roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "add",
        guildId,
        userId,
        roleId,
        duration,
      }),
    });

    const data = await res.json() as { assignments?: TimedRoleAssignment[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to add the timed role.");
      return;
    }

    setAssignments(data.assignments ?? []);
    setMessage(`Assigned ${roleId} to ${userId} for ${duration}.`);
    await onUpdated();
  }

  async function handleRemove(assignment: TimedRoleAssignment) {
    setMessage(null);
    setError(null);

    const res = await fetch("/admin/api/timed-roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "remove",
        guildId: assignment.guildId,
        userId: assignment.userId,
        roleId: assignment.roleId,
      }),
    });

    const data = await res.json() as { assignments?: TimedRoleAssignment[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to remove the timed role.");
      return;
    }

    setAssignments(data.assignments ?? []);
    setMessage(`Removed ${assignment.roleId} from ${assignment.userId}.`);
    await onUpdated();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="tr-guild">Guild ID</Label>
          <Input
            id="tr-guild"
            value={guildId}
            onChange={(e) => {
              setGuildId(e.target.value);
              setAssignments(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void loadAssignments(guildId);
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tr-user">User ID</Label>
          <Input id="tr-user" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tr-role">Role ID</Label>
          <Input id="tr-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tr-duration">Duration</Label>
          <Input id="tr-duration" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" disabled={!trimmedGuildId} onClick={() => void loadAssignments(guildId)}>Load timed roles</Button>
        <Button size="sm" onClick={() => void handleAdd()}>Add timed role</Button>
      </div>

      {assignments !== null && (
        assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timed roles are active in this guild.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={`${assignment.guildId}:${assignment.userId}:${assignment.roleId}`}>
                  <TableCell>{assignment.userId}</TableCell>
                  <TableCell>{assignment.roleId}</TableCell>
                  <TableCell>{assignment.durationInput}</TableCell>
                  <TableCell>{new Date(assignment.expiresAtMs).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleRemove(assignment)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      )}

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

async function readJsonOrThrow<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = (await response.text()) || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected dashboard error";
}

function formatHeartbeatInterval(intervalMs: number | null): string {
  if (intervalMs === null) {
    return "Unknown";
  }

  return `${Math.round(intervalMs / 1000)}s`;
}
