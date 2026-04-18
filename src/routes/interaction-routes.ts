import type { GatewayController, RuntimeStore } from "../runtime/contracts";

export interface InteractionRouteOptions {
  discordPublicKey: string;
  discordBotToken: string;
  verifyDiscordRequest?: (timestamp: string, body: string, signature: string) => Promise<boolean>;
  store: RuntimeStore;
  gateway: GatewayController;
}

export interface RouteHandler {
  (request: Request): Promise<Response | null>;
}

export function createInteractionRoutes(_options: InteractionRouteOptions): RouteHandler {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/interactions") {
      // Import the handler from app.ts (will be extracted later as part of refactoring)
      // For now, return null to delegate back to app.ts
      return null;
    }

    return null;
  };
}
