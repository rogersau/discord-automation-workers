import type { TicketInstance, TicketPanelConfig } from "../../types";

export interface TicketStore {
  reserveNextTicketNumber(guildId: string): Promise<number>;
  readTicketPanelConfig(guildId: string): Promise<TicketPanelConfig | null>;
  upsertTicketPanelConfig(panel: TicketPanelConfig): Promise<void>;
  createTicketInstance(instance: TicketInstance): Promise<void>;
  deleteTicketInstance(body: { guildId: string; channelId: string }): Promise<void>;
  readOpenTicketByChannel(guildId: string, channelId: string): Promise<TicketInstance | null>;
  closeTicketInstance(body: {
    guildId: string;
    channelId: string;
    closedByUserId: string;
    closedAtMs: number;
    transcriptMessageId: string | null;
  }): Promise<void>;
}
