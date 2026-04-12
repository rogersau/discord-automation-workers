import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBlocklistConfig,
  isEmojiBlocked,
  normalizeEmoji,
} from "../src/blocklist";

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
  assert.equal(normalizeEmoji(":blobcat:"), "blobcat");
});
