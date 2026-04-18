import type { GatewayController, RuntimeStore } from "../runtime/contracts";

export interface AdminRouteOptions {
  adminAuthSecret?: string;
  adminSessionSecret?: string;
  adminUiPassword?: string;
  discordBotToken: string;
  store: RuntimeStore;
  gateway: GatewayController;
}

export interface RouteHandler {
  (request: Request): Promise<Response | null>;
}

export function createAdminRoutes(_options: AdminRouteOptions): RouteHandler {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);

    // Admin routes are handled in app.ts for now
    // This module exists to establish the route separation pattern
    // Future refactoring can move admin route logic here
    if (url.pathname.startsWith("/admin")) {
      // Return null to delegate to app.ts
      return null;
    }

    return null;
  };
}
