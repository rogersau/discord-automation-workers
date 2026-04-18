/// <reference types="node/assert" />
/// <reference types="node/assert/strict" />

import assert from "node:assert/strict";
// @ts-ignore -- Test compiled via tsconfig.tests.json.
import test from "node:test";

import { createCloudflareStoreClient } from "../src/runtime/cloudflare-store-client";

test("createCloudflareStoreClient uses typed methods instead of exposing raw fetches", async () => {
  const requests: Array<{ url: string; method: string; body: string | null }> = [];
  const storeClient = createCloudflareStoreClient({
    fetch(input, init) {
      requests.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
      });
      return Promise.resolve(Response.json({ ok: true, guilds: {}, botUserId: "bot-user-id" }) as any);
    },
  });

  await storeClient.readConfig();
  await storeClient.applyGuildEmojiMutation({ guildId: "guild-1", emoji: "✅", action: "add" });

  assert.deepEqual(requests, [
    { url: "https://moderation-store/config", method: "GET", body: null },
    {
      url: "https://moderation-store/guild-emoji",
      method: "POST",
      body: JSON.stringify({ guildId: "guild-1", emoji: "✅", action: "add" }),
    },
  ]);
});
