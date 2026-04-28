import type { BlocklistStore } from "../runtime/contracts";
import { applyGuildEmojiMutation as applyGuildEmojiMutationWorkflow } from "./blocklist/apply-guild-emoji-mutation";
import { getGuildBlocklist as getGuildBlocklistWorkflow } from "./blocklist/get-guild-blocklist";

export interface BlocklistMutation {
  guildId: string;
  action: "add" | "remove";
  emoji: string;
}

export class BlocklistService {
  constructor(private readonly store: BlocklistStore) {}

  async applyMutation(mutation: BlocklistMutation): Promise<void> {
    await applyGuildEmojiMutationWorkflow(this.store, mutation);
  }

  async getGuildBlocklist(guildId: string): Promise<{ enabled: boolean; emojis: string[] }> {
    return getGuildBlocklistWorkflow(this.store, guildId);
  }

  async addEmoji(guildId: string, emoji: string): Promise<{ alreadyBlocked: boolean }> {
    const guildConfig = await this.getGuildBlocklist(guildId);
    const isAlreadyBlocked = guildConfig.emojis.includes(emoji);
    
    if (!isAlreadyBlocked) {
      await this.applyMutation({ guildId, emoji, action: "add" });
    }

    return { alreadyBlocked: isAlreadyBlocked };
  }

  async removeEmoji(guildId: string, emoji: string): Promise<{ wasBlocked: boolean }> {
    const guildConfig = await this.getGuildBlocklist(guildId);
    const isBlocked = guildConfig.emojis.includes(emoji);
    
    if (isBlocked) {
      await this.applyMutation({ guildId, emoji, action: "remove" });
    }

    return { wasBlocked: isBlocked };
  }
}
