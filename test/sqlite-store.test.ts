/// <reference types="node/assert" />
/// <reference types="node/assert/strict" />

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-ignore -- Runtime tests compile under tsconfig.tests.json.
import test from "node:test";

import { createSqliteRuntimeStore } from "../src/runtime/sqlite-store";

test("sqlite runtime store persists blocklist config and gateway session state", async () => {
  const dir = mkdtempSync(join(tmpdir(), "runtime-store-"));
  const sqlitePath = join(dir, "runtime.sqlite");

  try {
    const store = createSqliteRuntimeStore({ sqlitePath, botUserId: "bot-user-id" });
    await store.applyGuildEmojiMutation({ guildId: "guild-1", emoji: "✅", action: "add" });
    await store.writeGatewaySnapshot({
      status: "ready",
      sessionId: "session-1",
      resumeGatewayUrl: "wss://resume.discord.gg/?v=10&encoding=json",
      lastSequence: 42,
      backoffAttempt: 0,
      lastError: null,
      heartbeatIntervalMs: 45000,
    });

    const config = await store.readConfig();
    const snapshot = await store.readGatewaySnapshot();

    assert.deepEqual(config.guilds["guild-1"], { enabled: true, emojis: ["✅"] });
    assert.equal(snapshot.sessionId, "session-1");
    assert.equal(snapshot.lastSequence, 42);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
