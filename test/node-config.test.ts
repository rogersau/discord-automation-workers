/// <reference types="node/assert" />
/// <reference types="node/assert/strict" />

import assert from "node:assert/strict";
import test from "node:test";

import { loadNodeRuntimeConfig } from "../src/runtime/node-config";

test("loadNodeRuntimeConfig returns the validated portable runtime config", () => {
  const config = loadNodeRuntimeConfig({
    DISCORD_BOT_TOKEN: "bot-token",
    BOT_USER_ID: "bot-user-id",
    DISCORD_PUBLIC_KEY: "a".repeat(64),
    DISCORD_APPLICATION_ID: "application-id",
    ADMIN_AUTH_SECRET: "admin-secret",
    PORT: "8787",
    SQLITE_PATH: "./data/runtime.sqlite",
  });

  assert.deepEqual(config, {
    discordBotToken: "bot-token",
    botUserId: "bot-user-id",
    discordPublicKey: "a".repeat(64),
    discordApplicationId: "application-id",
    adminAuthSecret: "admin-secret",
    port: 8787,
    sqlitePath: "./data/runtime.sqlite",
  });
});

test("loadNodeRuntimeConfig accepts valid config with optional fields omitted", () => {
  const config = loadNodeRuntimeConfig({
    DISCORD_BOT_TOKEN: "bot-token",
    BOT_USER_ID: "bot-user-id",
    DISCORD_PUBLIC_KEY: "a".repeat(64),
    PORT: "8787",
    SQLITE_PATH: "./data/runtime.sqlite",
  });

  assert.deepEqual(config, {
    discordBotToken: "bot-token",
    botUserId: "bot-user-id",
    discordPublicKey: "a".repeat(64),
    discordApplicationId: undefined,
    adminAuthSecret: undefined,
    port: 8787,
    sqlitePath: "./data/runtime.sqlite",
  });
});

test("loadNodeRuntimeConfig rejects missing required values", () => {
  assert.throws(
    () => loadNodeRuntimeConfig({ PORT: "8787", SQLITE_PATH: "./data/runtime.sqlite" }),
    /DISCORD_BOT_TOKEN/
  );
});

test("loadNodeRuntimeConfig rejects invalid float port", () => {
  assert.throws(
    () =>
      loadNodeRuntimeConfig({
        DISCORD_BOT_TOKEN: "bot-token",
        BOT_USER_ID: "bot-user-id",
        DISCORD_PUBLIC_KEY: "a".repeat(64),
        PORT: "8787.5",
        SQLITE_PATH: "./data/runtime.sqlite",
      }),
    /PORT must be a valid port number/
  );
});

test("loadNodeRuntimeConfig rejects out-of-range port", () => {
  assert.throws(
    () =>
      loadNodeRuntimeConfig({
        DISCORD_BOT_TOKEN: "bot-token",
        BOT_USER_ID: "bot-user-id",
        DISCORD_PUBLIC_KEY: "a".repeat(64),
        PORT: "65536",
        SQLITE_PATH: "./data/runtime.sqlite",
      }),
    /PORT must be a valid port number/
  );
});
