import {
  addGuildMemberRole,
  removeGuildMemberRole,
  syncApplicationCommands,
} from "../discord";
import { createAdminRoutes } from "../routes/admin-routes";
import { createInteractionRoutes } from "../routes/interaction-routes";
import { createPublicRoutes } from "../routes/public-routes";
import { AdminOverviewService } from "../services/admin-overview-service";
import { BlocklistService } from "../services/blocklist-service";
import { GatewayService } from "../services/gateway-service";
import { TimedRoleService } from "../services/timed-role-service";
import { createAdminApiHandler, buildAdminOverviewGuilds } from "./admin-api";
import {
  getAdminLoginLocation,
  isAdminUiAuthorized,
  redirect,
  renderAdminShell,
  requireAdminSession,
} from "./admin-shell";
import type { RuntimeAppOptions } from "./app-types";
import { handleInteractionRequest } from "./interaction-handler";

export { escapeHtmlAttribute } from "./admin-shell";
export type { RuntimeAppOptions } from "./app-types";

export function createRuntimeApp(options: RuntimeAppOptions) {
  const gatewayService = new GatewayService(options.gateway, {
    discordApplicationId: options.discordApplicationId,
    syncApplicationCommands: options.discordApplicationId
      ? (appId) => syncApplicationCommands(appId, options.discordBotToken)
      : undefined,
  });

  const timedRoleService = new TimedRoleService(
    options.store,
    options.discordBotToken,
    (guildId, userId, roleId) => addGuildMemberRole(guildId, userId, roleId, options.discordBotToken),
    (guildId, userId, roleId) => removeGuildMemberRole(guildId, userId, roleId, options.discordBotToken)
  );

  const adminOverviewService = new AdminOverviewService(
    options.store,
    options.gateway,
    (config, timedRoles) => buildAdminOverviewGuilds(config, timedRoles, options.discordBotToken)
  );

  const blocklistService = new BlocklistService(options.store);
  const handleAdminApiRequest = createAdminApiHandler({
    store: options.store,
    discordBotToken: options.discordBotToken,
  });

  const publicRoutes = createPublicRoutes({
    ticketTranscriptBlobs: options.ticketTranscriptBlobs,
  });
  const adminRoutes = createAdminRoutes({
    adminSessionSecret: options.adminSessionSecret,
    adminUiPassword: options.adminUiPassword,
    services: {
      gatewayService,
      adminOverviewService,
      blocklistService,
      timedRoleService,
    },
    handleAdminApiRequest,
    redirect,
    getAdminLoginLocation,
    renderAdminShell,
    isAdminUiAuthorized,
    requireAdminSession,
  });
  const interactionRoutes = createInteractionRoutes({
    discordPublicKey: options.discordPublicKey,
    discordBotToken: options.discordBotToken,
    verifyDiscordRequest: options.verifyDiscordRequest,
    store: options.store,
    gateway: options.gateway,
    ticketTranscriptBlobs: options.ticketTranscriptBlobs,
    services: {
      timedRoleService,
      blocklistService,
    },
    handleInteractionRequest,
  });

  return {
    async fetch(request: Request): Promise<Response> {
      const publicResponse = await publicRoutes(request);
      if (publicResponse) return publicResponse;

      const adminResponse = await adminRoutes(request);
      if (adminResponse) return adminResponse;

      const interactionResponse = await interactionRoutes(request);
      if (interactionResponse) return interactionResponse;

      return new Response("Not found", { status: 404 });
    },
    async bootstrap() {
      return gatewayService.bootstrap();
    },
  };
}