/// <reference types="node/assert" />
/// <reference types="node/assert/strict" />

import {
  applyEmojiMutation,
  buildBlocklistConfig,
  isEmojiBlocked,
  normalizeEmoji,
} from "../src/blocklist";

import assert from "node:assert/strict";
// @ts-ignore -- The worker typecheck config omits Node built-ins and full node:test types conflict with Workers globals; tsconfig.tests provides the runtime test types.
import test from "node:test";

test("buildBlocklistConfig materializes global and guild rules", () => {
  const config = buildBlocklistConfig(
    [{ normalized_emoji: "✅" }],
    [{ guild_id: "guild-disabled", moderation_enabled: 0 }],
    [{ guild_id: "guild-1", normalized_emoji: "❌" }],
    [{ key: "bot_user_id", value: "bot-1" }]
  );

  assert.equal(isEmojiBlocked("✅", config, "any-guild"), true);
  assert.equal(isEmojiBlocked("❌", config, "guild-1"), true);
  assert.equal(config.guilds["guild-disabled"]?.enabled, false);
  assert.equal(config.botUserId, "bot-1");
});

test("guild-specific blocklists stay isolated per guild", () => {
  const config = buildBlocklistConfig(
    [],
    [
      { guild_id: "guild-disabled", moderation_enabled: 0 },
      { guild_id: "guild-1", moderation_enabled: 1 },
    ],
    [
      { guild_id: "guild-disabled", normalized_emoji: "❌" },
      { guild_id: "guild-1", normalized_emoji: "✅" },
    ],
    []
  );

  assert.equal(isEmojiBlocked("✅", config, "guild-1"), true);
  assert.equal(isEmojiBlocked("❌", config, "guild-1"), false);
  assert.equal(isEmojiBlocked("❌", config, "guild-disabled"), false);
  assert.equal(isEmojiBlocked("✅", config, "guild-disabled"), false);
});

test("missing bot_user_id materializes as an empty string", () => {
  const config = buildBlocklistConfig([], [], [], []);

  assert.equal(config.botUserId, "");
});

test("applyEmojiMutation adds uniquely and removes exact matches", () => {
  const config = buildBlocklistConfig(
    [{ normalized_emoji: "✅" }],
    [],
    [],
    []
  );

  const added = applyEmojiMutation(config, {
    scope: "global",
    action: "add",
    emoji: "❌",
  });
  const removed = applyEmojiMutation(added, {
    scope: "global",
    action: "remove",
    emoji: "✅",
  });

  assert.deepEqual(added.emojis, ["✅", "❌"]);
  assert.deepEqual(removed.emojis, ["❌"]);
});

test("normalizeEmoji handles null and empty input", () => {
  assert.equal(normalizeEmoji(null), null);
  assert.equal(normalizeEmoji(""), null);
  assert.equal(normalizeEmoji(":blobcat:"), "blobcat");
});
