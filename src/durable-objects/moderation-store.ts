import type {
  AppConfigRow,
  BlocklistConfig,
  GlobalBlockedEmojiRow,
  GuildBlockedEmojiRow,
  GuildSettingRow,
} from "../types";
import type { Env } from "../env";
import { buildBlocklistConfig, normalizeEmoji } from "../blocklist";
import { DEFAULT_BLOCKLIST } from "../types";

export class ModerationStoreDO implements DurableObject {
  private readonly sql: DurableObjectStorage["sql"];

  constructor(ctx: DurableObjectState, env: Env) {
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS global_blocked_emojis (
        normalized_emoji TEXT PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        moderation_enabled INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS guild_blocked_emojis (
        guild_id TEXT NOT NULL,
        normalized_emoji TEXT NOT NULL,
        PRIMARY KEY (guild_id, normalized_emoji)
      );
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    for (const emoji of DEFAULT_BLOCKLIST.emojis) {
      this.sql.exec(
        "INSERT OR IGNORE INTO global_blocked_emojis(normalized_emoji) VALUES(?)",
        emoji
      );
    }

    this.sql.exec(
      "INSERT OR IGNORE INTO app_config(key, value) VALUES(?, ?)",
      "bot_user_id",
      env.BOT_USER_ID
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/config") {
      return Response.json(this.readConfig());
    }

    if (
      (request.method === "POST" || request.method === "PUT") &&
      url.pathname === "/emoji"
    ) {
      try {
        const body = await request.json<{ emoji?: string; action?: string }>();
        return Response.json(await this.applyGlobalEmojiMutation(body));
      } catch (error) {
        return this.errorResponse(error);
      }
    }

    if (request.method === "POST" && url.pathname === "/app-config") {
      try {
        const body = await request.json<{ key?: string; value?: string }>();
        return Response.json(await this.upsertAppConfig(body));
      } catch (error) {
        return this.errorResponse(error);
      }
    }

    return new Response("Not found", { status: 404 });
  }

  private readConfig(): BlocklistConfig {
    const globalRows: GlobalBlockedEmojiRow[] = [
      ...this.sql.exec("SELECT normalized_emoji FROM global_blocked_emojis"),
    ].map((row) => ({
      normalized_emoji: row.normalized_emoji as string,
    }));
    const guildRows: GuildSettingRow[] = [
      ...this.sql.exec("SELECT guild_id, moderation_enabled FROM guild_settings"),
    ].map((row) => ({
      guild_id: row.guild_id as string,
      moderation_enabled: row.moderation_enabled as number,
    }));
    const guildEmojiRows: GuildBlockedEmojiRow[] = [
      ...this.sql.exec(
        "SELECT guild_id, normalized_emoji FROM guild_blocked_emojis"
      ),
    ].map((row) => ({
      guild_id: row.guild_id as string,
      normalized_emoji: row.normalized_emoji as string,
    }));
    const appConfigRows: AppConfigRow[] = [
      ...this.sql.exec("SELECT key, value FROM app_config"),
    ].map((row) => ({
      key: row.key as string,
      value: row.value as string,
    }));

    return buildBlocklistConfig(globalRows, guildRows, guildEmojiRows, appConfigRows);
  }

  private async upsertAppConfig(body: {
    key?: string;
    value?: string;
  }): Promise<{ ok: true }> {
    if (!body.key || typeof body.value !== "string") {
      throw new Error("Missing app config key or value");
    }

    this.sql.exec(
      "INSERT INTO app_config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      body.key,
      body.value
    );

    return { ok: true };
  }

  private async applyGlobalEmojiMutation(body: {
    emoji?: string;
    action?: string;
  }): Promise<BlocklistConfig> {
    const normalizedEmoji = normalizeEmoji(body.emoji ?? null);
    if (!normalizedEmoji || !body.action) {
      throw new Error("Missing emoji or action");
    }

    if (body.action !== "add" && body.action !== "remove") {
      throw new Error("Invalid action. Use 'add' or 'remove'");
    }

    if (body.action === "add") {
      this.sql.exec(
        "INSERT OR IGNORE INTO global_blocked_emojis(normalized_emoji) VALUES(?)",
        normalizedEmoji
      );
    } else {
      this.sql.exec(
        "DELETE FROM global_blocked_emojis WHERE normalized_emoji = ?",
        normalizedEmoji
      );
    }

    return this.readConfig();
  }

  private errorResponse(error: unknown): Response {
    const message =
      error instanceof Error ? error.message : "Invalid JSON body";

    return Response.json({ error: message }, { status: 400 });
  }
}
