import type { TicketPanelConfig } from "../types";

export interface AppConfigMutation {
  key: string;
  value: string;
}

export interface AdminSessionPayload {
  exp: number;
}

export interface AdminGuildDirectoryEntry {
  guildId: string;
  name: string;
  label: string;
}

export interface AdminGuildDirectoryResponse {
  guilds: AdminGuildDirectoryEntry[];
}

export type TicketPanelConfigPayload = TicketPanelConfig;

export type TicketPanelConfigResource = TicketPanelConfig;

export interface GuildTicketResourceSummary {
  guildId: string;
  ticketPanelConfig: TicketPanelConfigResource | null;
  openTicketCount: number;
}
