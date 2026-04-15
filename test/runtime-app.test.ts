/// <reference types="node/assert" />
/// <reference types="node/assert/strict" />

import assert from "node:assert/strict";
// @ts-ignore -- Runtime tests compile under tsconfig.tests.json.
import test from "node:test";

import { createRuntimeApp } from "../src/runtime/app";
import type { GatewayController, RuntimeStore } from "../src/runtime/contracts";

test("createRuntimeApp returns health, interaction ping, slash-command, and admin gateway responses through shared adapters", async () => {
  const calls: string[] = [];
  const app = createRuntimeApp({
    discordPublicKey: "a".repeat(64),
    discordBotToken: "bot-token",
    discordApplicationId: "application-id",
    adminAuthSecret: "admin-secret",
    verifyDiscordRequest: async () => true,
    store: {
      async readConfig() {
        return { emojis: [], guilds: {}, botUserId: "bot-user-id" };
      },
      async applyGuildEmojiMutation() {
        return { emojis: [], guilds: {}, botUserId: "bot-user-id" };
      },
      async listTimedRolesByGuild() {
        return [];
      },
      async upsertTimedRole() {},
      async deleteTimedRole() {},
      async listExpiredTimedRoles() {
        return [];
      },
      async readGatewaySnapshot() {
        return { status: "idle", sessionId: null, resumeGatewayUrl: null, lastSequence: null, backoffAttempt: 0, lastError: null, heartbeatIntervalMs: null };
      },
      async writeGatewaySnapshot() {},
    } as RuntimeStore,
    gateway: {
      async start() {
        calls.push("start");
        return { status: "connecting", sessionId: null, resumeGatewayUrl: null, lastSequence: null, backoffAttempt: 0, lastError: null, heartbeatIntervalMs: null };
      },
      async status() {
        calls.push("status");
        return { status: "idle", sessionId: null, resumeGatewayUrl: null, lastSequence: null, backoffAttempt: 0, lastError: null, heartbeatIntervalMs: null };
      },
    } as GatewayController,
  });

  const healthResponse = await app.fetch(new Request("https://runtime.example/health"));
  const pingResponse = await app.fetch(
    new Request("https://runtime.example/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature-ed25519": "ignored-for-ping-test",
        "x-signature-timestamp": String(Math.floor(Date.now() / 1000)),
      },
      body: JSON.stringify({ type: 1 }),
    })
  );
  const listResponse = await app.fetch(
    new Request("https://runtime.example/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature-ed25519": "ignored-for-command-test",
        "x-signature-timestamp": String(Math.floor(Date.now() / 1000)),
      },
      body: JSON.stringify({
        type: 2,
        guild_id: "guild-1",
        member: { permissions: "8" },
        data: {
          name: "blocklist",
          options: [{ type: 1, name: "list" }],
        },
      }),
    })
  );
  const statusResponse = await app.fetch(
    new Request("https://runtime.example/admin/gateway/status", {
      headers: { Authorization: "Bearer admin-secret" },
    })
  );

  assert.equal(healthResponse.status, 200);
  assert.equal(await healthResponse.text(), "OK");
  assert.deepEqual(await pingResponse.json(), { type: 1 });
  assert.deepEqual(await listResponse.json(), {
    type: 4,
    data: { flags: 64, content: "No emojis are blocked in this server." },
  });
  assert.deepEqual(await statusResponse.json(), {
    status: "idle",
    sessionId: null,
    resumeGatewayUrl: null,
    lastSequence: null,
    backoffAttempt: 0,
    lastError: null,
    heartbeatIntervalMs: null,
  });
  assert.deepEqual(calls, ["status"]);
});
