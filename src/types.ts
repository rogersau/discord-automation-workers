// Discord webhook event types

export interface DiscordEmoji {
  id: string | null;
  name: string | null;
  animated: boolean;
}

export interface DiscordReaction {
  channel_id: string;
  message_id: string;
  guild_id: string | undefined;
  emoji: DiscordEmoji;
  user_id: string;
}

export interface GlobalBlockedEmojiRow {
  normalized_emoji: string;
}

export interface GuildSettingRow {
  guild_id: string;
  moderation_enabled: number;
}

export interface GuildBlockedEmojiRow {
  guild_id: string;
  normalized_emoji: string;
}

export interface AppConfigRow {
  key: string;
  value: string;
}

export interface GlobalEmojiMutation {
  scope: "global";
  action: "add" | "remove";
  emoji: string;
}

// Effective blocklist config materialized from the moderation store.
export interface BlocklistConfig {
  emojis: string[];
  guilds: {
    [guildId: string]: {
      enabled: boolean;
      emojis: string[];  // Guild-specific overrides
    };
  };
  botUserId: string;  // Bot's own user ID to ignore its reactions
}

export const DEFAULT_BLOCKLIST: BlocklistConfig = {
  emojis: [
    "🏳️‍🌈",  // Rainbow flag
    "🏳️‍⚧️",  // Trans flag
    "🏳️",    // White flag
    "🟤",    // Brown flag (sometimes used as anti flag)
    "🏴",    // Black flag
    "🏴‍☠️",  // Pirate flag
    "☣️",    // Biohazard / various
    "🔞",    // NSFW
    "🍎",    // Apple (context-dependent)
  ],
  guilds: {},
  botUserId: "",
};
