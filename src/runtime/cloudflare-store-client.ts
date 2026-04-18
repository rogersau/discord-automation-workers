import type { BlocklistConfig, TimedRoleAssignment } from "../types";

export function createCloudflareStoreClient(storeStub: { fetch: (...args: any[]) => Promise<any> }) {
  return {
    async readConfig(): Promise<BlocklistConfig> {
      return readJson(storeStub.fetch("https://moderation-store/config"));
    },
    async applyGuildEmojiMutation(body: { guildId: string; emoji: string; action: "add" | "remove" }): Promise<BlocklistConfig> {
      return readJson(
        storeStub.fetch("https://moderation-store/guild-emoji", {
          method: "POST",
          body: JSON.stringify(body),
        })
      );
    },
    async upsertAppConfig(body: { key: string; value: string }): Promise<void> {
      await readJsonVoid(
        storeStub.fetch("https://moderation-store/app-config", {
          method: "POST",
          body: JSON.stringify(body),
        })
      );
    },
    async listTimedRolesByGuild(guildId: string): Promise<TimedRoleAssignment[]> {
      return readJson(
        storeStub.fetch(`https://moderation-store/timed-roles?guildId=${encodeURIComponent(guildId)}`)
      );
    },
    async upsertTimedRole(body: {
      guildId: string;
      userId: string;
      roleId: string;
      durationInput: string;
      expiresAtMs: number;
    }): Promise<void> {
      await readJsonVoid(
        storeStub.fetch("https://moderation-store/timed-role", {
          method: "POST",
          body: JSON.stringify(body),
        })
      );
    },
  };
}

async function readJson(responsePromise: Promise<unknown>): Promise<any> {
  const response = await responsePromise as Response;
  if (!response.ok) {
    throw new Error(`Cloudflare store request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function readJsonVoid(responsePromise: Promise<unknown>): Promise<void> {
  const response = await responsePromise as Response;
  if (!response.ok) {
    throw new Error(`Cloudflare store request failed: ${response.status} ${await response.text()}`);
  }
}
