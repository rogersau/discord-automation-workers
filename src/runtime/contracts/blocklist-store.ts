import type { BlocklistConfig } from "../../types";

export interface BlocklistStore {
  readConfig(): Promise<BlocklistConfig>;
  applyGuildEmojiMutation(body: {
    guildId: string;
    emoji: string;
    action: "add" | "remove";
  }): Promise<BlocklistConfig>;
}
