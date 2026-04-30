import { GuildOverviewCard, type AdminOverviewGuild } from "./guild-overview-card";
import { AdminPageHeader } from "./admin-page-header";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface GatewayStatus {
  status: string;
}

interface AdminOverview {
  guilds: AdminOverviewGuild[];
}

export function AdminOverviewPage({
  gatewayStatus,
  overview,
  overviewError,
  directoryError,
  guildNamesById,
  onStartGateway,
  onRefresh,
}: {
  gatewayStatus: GatewayStatus | null;
  overview: AdminOverview | null;
  overviewError: string | null;
  directoryError: string | null;
  guildNamesById: Map<string, string>;
  onStartGateway: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const totalTimedRoles = overview
    ? overview.guilds.reduce((sum, guild) => sum + guild.timedRoles.length, 0)
    : null;

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Overview"
        description="Operational overview, gateway health, and quick actions."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Gateway</CardTitle>
          </CardHeader>
          <CardContent>{gatewayStatus?.status ?? "Loading"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stored servers</CardTitle>
          </CardHeader>
          <CardContent>{overview ? String(overview.guilds.length) : "-"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Timed roles</CardTitle>
          </CardHeader>
          <CardContent>{totalTimedRoles === null ? "-" : String(totalTimedRoles)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => void onStartGateway()}
          >
            Start gateway
          </Button>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            variant="outline"
            onClick={() => void onRefresh()}
          >
            Refresh dashboard
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stored server data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {overviewError ? (
            <Alert variant="destructive">
              <AlertDescription>{overviewError}</AlertDescription>
            </Alert>
          ) : null}
          {directoryError ? (
            <Alert>
              <AlertDescription>
                Server names are unavailable right now, so raw guild IDs may be shown.
              </AlertDescription>
            </Alert>
          ) : null}
          {overview ? (
            overview.guilds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No blocklists or timed roles are stored yet.
              </p>
            ) : (
              overview.guilds.map((guild) => (
                <GuildOverviewCard
                  key={guild.guildId}
                  guild={guild}
                  guildName={guildNamesById.get(guild.guildId) ?? null}
                />
              ))
            )
          ) : (
            <p className="text-sm text-muted-foreground">Loading stored server data...</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
