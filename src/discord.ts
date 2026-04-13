// Discord API helpers

import type { DiscordReaction } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Delete a reaction from a message.
 * Requires the bot to have MANAGE_MESSAGES permission in the channel.
 */
export async function deleteReaction(
  channelId: string,
  messageId: string,
  emoji: DiscordReaction["emoji"],
  userId: string,
  botToken: string
): Promise<void> {
  // Encode emoji for URL - handle both custom and unicode emojis
  const encodedEmoji = encodeEmoji(emoji);

  const url = `${DISCORD_API}/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/${encodeURIComponent(userId)}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.text().catch(() => "Unknown error");
    console.error(`Failed to delete reaction: ${response.status} - ${error}`);
    throw new Error(`Discord API error: ${response.status}`);
  }
}

/**
 * Encode an emoji for use in Discord API URLs.
 * Custom emojis: name:id format
 * Unicode emojis: URL-encoded
 */
function encodeEmoji(emoji: DiscordReaction["emoji"]): string {
  if (emoji.id && emoji.name) {
    // Custom emoji: name:id format
    return `${emoji.name}:${emoji.id}`;
  } else if (emoji.name) {
    // Unicode emoji: needs URL encoding
    return encodeURIComponent(emoji.name);
  }
  throw new Error("Invalid emoji: no name or id");
}
