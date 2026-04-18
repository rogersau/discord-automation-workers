import type { Env } from "../env";
import { assertValidDiscordPublicKey } from "../discord";
import { getModerationStoreStub } from "../reaction-moderation";
import { createCloudflareStoreClient } from "./cloudflare-store-client";
import { createCloudflareGatewayClient } from "./cloudflare-gateway-client";
import type { RuntimeStore, GatewayController } from "./contracts";
import type { TicketInstance, TicketPanelConfig } from "../types";

export interface RuntimeAppContext {
  discordPublicKey: string;
  discordBotToken: string;
  discordApplicationId?: string;
  adminAuthSecret?: string;
  adminUiPassword?: string;
  adminSessionSecret?: string;
  verifyDiscordRequest?: (timestamp: string, body: string, signature: string) => Promise<boolean>;
  store: RuntimeStore;
  gateway: GatewayController;
}

export function createCloudflareContext(env: Env): RuntimeAppContext {
  const gatewayStub = env.GATEWAY_SESSION_DO.get(env.GATEWAY_SESSION_DO.idFromName("gateway-session"));
  const storeStub = getModerationStoreStub(env);

  const storeClient = createCloudflareStoreClient(storeStub);
  const gatewayClient = createCloudflareGatewayClient(gatewayStub);

  const context: RuntimeAppContext = {
    discordPublicKey: assertValidDiscordPublicKey(env.DISCORD_PUBLIC_KEY),
    discordBotToken: env.DISCORD_BOT_TOKEN,
    discordApplicationId: env.DISCORD_APPLICATION_ID,
    adminAuthSecret: env.ADMIN_AUTH_SECRET,
    adminUiPassword: env.ADMIN_UI_PASSWORD,
    adminSessionSecret: env.ADMIN_SESSION_SECRET,
    store: {
      readConfig: storeClient.readConfig,
      applyGuildEmojiMutation: storeClient.applyGuildEmojiMutation,
      upsertAppConfig: storeClient.upsertAppConfig,
      async readTicketPanelConfig(guildId) {
        const response = await storeStub.fetch(
          `https://moderation-store/ticket-panel?guildId=${encodeURIComponent(guildId)}`
        );
        return response.json();
      },
      async upsertTicketPanelConfig(panel: TicketPanelConfig) {
        const response = await storeStub.fetch("https://moderation-store/ticket-panel", {
          method: "POST",
          body: JSON.stringify(panel),
        });
        if (!response.ok) {
          throw new Error(`Failed to upsert ticket panel: ${response.status} ${await response.text()}`);
        }
      },
      async createTicketInstance(instance: TicketInstance) {
        const response = await storeStub.fetch("https://moderation-store/ticket-instance", {
          method: "POST",
          body: JSON.stringify(instance),
        });
        if (!response.ok) {
          throw new Error(`Failed to create ticket instance: ${response.status} ${await response.text()}`);
        }
      },
      async deleteTicketInstance(body: { guildId: string; channelId: string }) {
        const response = await storeStub.fetch("https://moderation-store/ticket-instance/delete", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error(`Failed to delete ticket instance: ${response.status} ${await response.text()}`);
        }
      },
      async readOpenTicketByChannel(guildId, channelId) {
        const response = await storeStub.fetch(
          `https://moderation-store/ticket-instance/open?guildId=${encodeURIComponent(guildId)}&channelId=${encodeURIComponent(channelId)}`
        );
        return response.json();
      },
      async closeTicketInstance(body) {
        const response = await storeStub.fetch("https://moderation-store/ticket-instance/close", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error(`Failed to close ticket instance: ${response.status} ${await response.text()}`);
        }
      },
      listTimedRolesByGuild: storeClient.listTimedRolesByGuild,
      async listTimedRoles() {
        const response = await storeStub.fetch("https://moderation-store/timed-roles");
        return response.json();
      },
      upsertTimedRole: storeClient.upsertTimedRole,
      async deleteTimedRole(body) {
        const response = await storeStub.fetch("https://moderation-store/timed-role/remove", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error(`Failed to delete timed role: ${response.status} ${await response.text()}`);
        }
      },
      async listExpiredTimedRoles() {
        return [];
      },
      async readGatewaySnapshot() {
        const response = await gatewayStub.fetch("https://gateway-session/status");
        return response.json();
      },
      async writeGatewaySnapshot() {
        // Cloudflare: Gateway session state persists in Durable Object storage
      },
    },
    gateway: {
      start: gatewayClient.start,
      status: gatewayClient.status,
    },
  };

  return context;
}
