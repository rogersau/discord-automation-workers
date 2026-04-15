import Database from "better-sqlite3";
import type { BlocklistConfig, TimedRoleAssignment } from "../types";
import type { GatewaySnapshot, RuntimeStore } from "./contracts";
import { buildBlocklistConfig } from "../blocklist";

export interface SqliteRuntimeStoreOptions {
  sqlitePath: string;
  botUserId: string;
}

export function createSqliteRuntimeStore(options: SqliteRuntimeStoreOptions): RuntimeStore {
  const db = new Database(options.sqlitePath);
  
  db.exec(`
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
    CREATE TABLE IF NOT EXISTS timed_roles (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      duration_input TEXT NOT NULL,
      expires_at_ms INTEGER NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id, role_id)
    );
    CREATE TABLE IF NOT EXISTS gateway_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT NOT NULL,
      session_id TEXT,
      resume_gateway_url TEXT,
      last_sequence INTEGER,
      backoff_attempt INTEGER NOT NULL,
      last_error TEXT,
      heartbeat_interval_ms INTEGER
    );
  `);

  const insertBotUserId = db.prepare(
    "INSERT OR IGNORE INTO app_config(key, value) VALUES(?, ?)"
  );
  insertBotUserId.run("bot_user_id", options.botUserId);

  return {
    async readConfig(): Promise<BlocklistConfig> {
      const guildRows = db.prepare("SELECT guild_id, moderation_enabled FROM guild_settings").all() as Array<{
        guild_id: string;
        moderation_enabled: number;
      }>;
      const guildEmojiRows = db.prepare("SELECT guild_id, normalized_emoji FROM guild_blocked_emojis").all() as Array<{
        guild_id: string;
        normalized_emoji: string;
      }>;
      const appConfigRows = db.prepare("SELECT key, value FROM app_config").all() as Array<{
        key: string;
        value: string;
      }>;

      return buildBlocklistConfig(guildRows, guildEmojiRows, appConfigRows);
    },

    async applyGuildEmojiMutation(body: { guildId: string; emoji: string; action: "add" | "remove" }): Promise<BlocklistConfig> {
      if (body.action === "add") {
        db.prepare("INSERT OR IGNORE INTO guild_settings(guild_id, moderation_enabled) VALUES(?, ?)").run(
          body.guildId,
          1
        );
        db.prepare("INSERT OR IGNORE INTO guild_blocked_emojis(guild_id, normalized_emoji) VALUES(?, ?)").run(
          body.guildId,
          body.emoji
        );
      } else {
        db.prepare("DELETE FROM guild_blocked_emojis WHERE guild_id = ? AND normalized_emoji = ?").run(
          body.guildId,
          body.emoji
        );
      }

      return this.readConfig();
    },

    async listTimedRolesByGuild(guildId: string): Promise<TimedRoleAssignment[]> {
      const rows = db.prepare(
        "SELECT guild_id, user_id, role_id, duration_input, expires_at_ms FROM timed_roles WHERE guild_id = ? ORDER BY expires_at_ms ASC"
      ).all(guildId) as Array<{
        guild_id: string;
        user_id: string;
        role_id: string;
        duration_input: string;
        expires_at_ms: number;
      }>;

      return rows.map((row) => ({
        guildId: row.guild_id,
        userId: row.user_id,
        roleId: row.role_id,
        durationInput: row.duration_input,
        expiresAtMs: row.expires_at_ms,
      }));
    },

    async upsertTimedRole(body: TimedRoleAssignment): Promise<void> {
      const now = Date.now();
      db.prepare(
        "INSERT INTO timed_roles(guild_id, user_id, role_id, duration_input, expires_at_ms, created_at_ms, updated_at_ms) VALUES(?, ?, ?, ?, ?, ?, ?) ON CONFLICT(guild_id, user_id, role_id) DO UPDATE SET duration_input = excluded.duration_input, expires_at_ms = excluded.expires_at_ms, updated_at_ms = excluded.updated_at_ms"
      ).run(
        body.guildId,
        body.userId,
        body.roleId,
        body.durationInput,
        body.expiresAtMs,
        now,
        now
      );
    },

    async deleteTimedRole(body: { guildId: string; userId: string; roleId: string }): Promise<void> {
      db.prepare("DELETE FROM timed_roles WHERE guild_id = ? AND user_id = ? AND role_id = ?").run(
        body.guildId,
        body.userId,
        body.roleId
      );
    },

    async listExpiredTimedRoles(nowMs: number): Promise<TimedRoleAssignment[]> {
      const rows = db.prepare(
        "SELECT guild_id, user_id, role_id, duration_input, expires_at_ms FROM timed_roles WHERE expires_at_ms <= ? ORDER BY expires_at_ms ASC"
      ).all(nowMs) as Array<{
        guild_id: string;
        user_id: string;
        role_id: string;
        duration_input: string;
        expires_at_ms: number;
      }>;

      return rows.map((row) => ({
        guildId: row.guild_id,
        userId: row.user_id,
        roleId: row.role_id,
        durationInput: row.duration_input,
        expiresAtMs: row.expires_at_ms,
      }));
    },

    async readGatewaySnapshot(): Promise<GatewaySnapshot> {
      const row = db.prepare("SELECT * FROM gateway_session WHERE id = 1").get() as {
        status: string;
        session_id: string | null;
        resume_gateway_url: string | null;
        last_sequence: number | null;
        backoff_attempt: number;
        last_error: string | null;
        heartbeat_interval_ms: number | null;
      } | undefined;

      if (!row) {
        return {
          status: "idle",
          sessionId: null,
          resumeGatewayUrl: null,
          lastSequence: null,
          backoffAttempt: 0,
          lastError: null,
          heartbeatIntervalMs: null,
        };
      }

      return {
        status: row.status as GatewaySnapshot["status"],
        sessionId: row.session_id,
        resumeGatewayUrl: row.resume_gateway_url,
        lastSequence: row.last_sequence,
        backoffAttempt: row.backoff_attempt,
        lastError: row.last_error,
        heartbeatIntervalMs: row.heartbeat_interval_ms,
      };
    },

    async writeGatewaySnapshot(snapshot: GatewaySnapshot): Promise<void> {
      db.prepare(
        `INSERT INTO gateway_session(id, status, session_id, resume_gateway_url, last_sequence, backoff_attempt, last_error, heartbeat_interval_ms)
         VALUES(1, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           session_id = excluded.session_id,
           resume_gateway_url = excluded.resume_gateway_url,
           last_sequence = excluded.last_sequence,
           backoff_attempt = excluded.backoff_attempt,
           last_error = excluded.last_error,
           heartbeat_interval_ms = excluded.heartbeat_interval_ms`
      ).run(
        snapshot.status,
        snapshot.sessionId,
        snapshot.resumeGatewayUrl,
        snapshot.lastSequence,
        snapshot.backoffAttempt,
        snapshot.lastError,
        snapshot.heartbeatIntervalMs
      );
    },
  };
}
