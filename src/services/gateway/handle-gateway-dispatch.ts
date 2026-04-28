import { shouldHandleDispatch } from "../../gateway";
import type { DiscordReaction } from "../../types";

export async function handleGatewayDispatch(
  payload: { op: number; t?: string | null; d?: unknown },
  moderateReactionAdd: (reaction: DiscordReaction | null) => Promise<void>
): Promise<void> {
  if (!shouldHandleDispatch({ op: payload.op, t: payload.t ?? null })) {
    return;
  }

  await moderateReactionAdd(payload.d as DiscordReaction | null);
}
