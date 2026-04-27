import { listBotGuilds } from "../discord";
import type {
  AdminGuildDirectoryEntry,
  AdminGuildDirectoryResponse,
  AdminPermissionCheck,
  AdminPermissionCheckResponse,
  AdminPermissionFeature,
  AppConfigMutation,
} from "./admin-types";
import {
  buildBlocklistPermissionChecks,
  buildTicketPermissionChecks,
  buildTimedRolePermissionChecks,
  loadGuildPermissionContext,
} from "./admin-permissions";
import {
  AdminApiInputError,
  isRecord,
  parseJsonBody,
} from "./admin-api-validation";
import type { RuntimeStore } from "./contracts";
import { handleTicketPanelAdminRequest } from "./ticket-panel-admin";
import type { BlocklistConfig, TimedRoleAssignment } from "../types";

interface AdminOverviewGuild {
  guildId: string;
  emojis: string[];
  timedRoles: TimedRoleAssignment[];
  permissionChecks: AdminPermissionCheck[];
}

export interface AdminApiHandlerOptions {
  store: RuntimeStore;
  discordBotToken: string;
}

export function createAdminApiHandler(options: AdminApiHandlerOptions) {
  return async (request: Request, url: URL): Promise<Response | null> => {
    if (url.pathname.startsWith("/admin/api/tickets/")) {
      const ticketResponse = await handleTicketPanelAdminRequest(request, url, options);
      if (ticketResponse) {
        return ticketResponse;
      }
    }

    if (request.method === "GET" && url.pathname === "/admin/api/permissions") {
      const guildId = url.searchParams.get("guildId");
      const featureParam = url.searchParams.get("feature");
      if (!guildId) {
        return Response.json({ error: "guildId is required" }, { status: 400 });
      }
      if (!isAdminPermissionFeature(featureParam)) {
        return Response.json({ error: "feature must be blocklist, timed-roles, or tickets" }, { status: 400 });
      }

      try {
        return Response.json(
          await buildAdminPermissionResponse(
            guildId,
            featureParam,
            options.store,
            options.discordBotToken
          )
        );
      } catch (error) {
        return Response.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to load the bot's current Discord permissions.",
          },
          { status: 502 }
        );
      }
    }

    if (request.method === "GET" && url.pathname === "/admin/api/guilds") {
      const guilds = buildAdminGuildDirectory(await listBotGuilds(options.discordBotToken));
      const body: AdminGuildDirectoryResponse = { guilds };
      return Response.json(body);
    }

    if (request.method === "GET" && url.pathname === "/admin/api/config") {
      const config = await options.store.readConfig();
      return Response.json({ botUserId: config.botUserId });
    }

    if (request.method === "POST" && url.pathname === "/admin/api/config") {
      const parsedBody = await parseJsonBody(request, parseAppConfigMutation);
      if (!parsedBody.ok) {
        return parsedBody.response;
      }

      await options.store.upsertAppConfig(parsedBody.value);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  };
}

export async function buildAdminOverviewGuilds(
  config: BlocklistConfig,
  timedRoles: TimedRoleAssignment[],
  discordBotToken: string
): Promise<AdminOverviewGuild[]> {
  const guilds = new Map<string, AdminOverviewGuild>();

  for (const [guildId, guildConfig] of Object.entries(config.guilds)) {
    guilds.set(guildId, {
      guildId,
      emojis: [...guildConfig.emojis],
      timedRoles: [],
      permissionChecks: [],
    });
  }

  for (const timedRole of timedRoles) {
    const existing = guilds.get(timedRole.guildId);
    if (existing) {
      existing.timedRoles.push(timedRole);
      continue;
    }

    guilds.set(timedRole.guildId, {
      guildId: timedRole.guildId,
      emojis: [],
      timedRoles: [timedRole],
      permissionChecks: [],
    });
  }

  await Promise.all(
    [...guilds.values()].map(async (guild) => {
      if (guild.emojis.length === 0 && guild.timedRoles.length === 0) {
        return;
      }

      try {
        const context = await loadGuildPermissionContext(
          guild.guildId,
          config.botUserId,
          discordBotToken
        );
        guild.permissionChecks = [
          ...(guild.emojis.length > 0 ? buildBlocklistPermissionChecks(context) : []),
          ...(guild.timedRoles.length > 0 ? buildTimedRolePermissionChecks(context, guild.timedRoles) : []),
        ].filter((check) => check.status !== "ok");
      } catch (error) {
        guild.permissionChecks = [
          {
            label: "Discord permission check unavailable",
            status: "warning",
            detail:
              error instanceof Error
                ? error.message
                : "Failed to load the bot's current Discord permissions.",
          },
        ];
      }
    })
  );

  return [...guilds.values()].sort((left, right) => left.guildId.localeCompare(right.guildId));
}

async function buildAdminPermissionResponse(
  guildId: string,
  feature: AdminPermissionFeature,
  store: RuntimeStore,
  discordBotToken: string
): Promise<AdminPermissionCheckResponse> {
  const config = await store.readConfig();
  const context = await loadGuildPermissionContext(guildId, config.botUserId, discordBotToken);

  if (feature === "blocklist") {
    return {
      guildId,
      feature,
      checks: buildBlocklistPermissionChecks(context),
    };
  }

  if (feature === "timed-roles") {
    return {
      guildId,
      feature,
      checks: buildTimedRolePermissionChecks(context, await store.listTimedRolesByGuild(guildId)),
    };
  }

  return {
    guildId,
    feature,
    checks: buildTicketPermissionChecks(context, await store.readTicketPanelConfig(guildId)),
  };
}

function isAdminPermissionFeature(value: string | null): value is AdminPermissionFeature {
  return value === "blocklist" || value === "timed-roles" || value === "tickets";
}

function buildAdminGuildDirectory(
  guilds: Array<{ guildId: string; name: string }>
): AdminGuildDirectoryEntry[] {
  const nameCounts = new Map<string, number>();

  for (const guild of guilds) {
    nameCounts.set(guild.name, (nameCounts.get(guild.name) ?? 0) + 1);
  }

  return [...guilds]
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.guildId.localeCompare(right.guildId)
    )
    .map((guild) => ({
      guildId: guild.guildId,
      name: guild.name,
      label:
        (nameCounts.get(guild.name) ?? 0) > 1
          ? `${guild.name} (${guild.guildId})`
          : guild.name,
    }));
}

function parseAppConfigMutation(body: unknown): AppConfigMutation {
  if (
    !isRecord(body) ||
    typeof body.key !== "string" ||
    body.key.length === 0 ||
    typeof body.value !== "string"
  ) {
    throw new AdminApiInputError("Missing app config key or value");
  }

  return {
    key: body.key,
    value: body.value,
  };
}