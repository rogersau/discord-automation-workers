/**
 * Discord Reaction Moderator - Cloudflare Worker
 *
 * Public entry point for health checks, admin APIs, and scheduled gateway bootstrap.
 */

import { GatewaySessionDO } from "./durable-objects/gateway-session";
import { ModerationStoreDO } from "./durable-objects/moderation-store";
import type { Env } from "./env";
import { getModerationStoreStub } from "./reaction-moderation";

export { GatewaySessionDO, ModerationStoreDO };

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // Admin endpoint to view/update blocklist
    if (url.pathname === "/admin/blocklist") {
      return handleAdminRequest(request, env);
    }

    if (
      url.pathname === "/admin/gateway/status" ||
      url.pathname === "/admin/gateway/start"
    ) {
      return handleGatewayAdminRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },

  scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): void {
    if (!env.DISCORD_BOT_TOKEN) {
      return;
    }

    ctx.waitUntil(startGatewaySession(env));
  },
};

/**
 * Admin endpoint for managing the blocklist.
 * Uses optional bearer token auth when ADMIN_AUTH_SECRET is configured.
 */
async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
  if (!isAuthorizedAdminRequest(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const method = request.method;
  const storeStub = getModerationStoreStub(env);

  if (method === "GET") {
    return storeStub.fetch("https://moderation-store/config");
  }

  if (method === "POST" || method === "PUT") {
    return storeStub.fetch("https://moderation-store/emoji", {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    });
  }

  return new Response("Method not allowed", { status: 405 });
}
async function handleGatewayAdminRequest(
  request: Request,
  env: Env
): Promise<Response> {
  if (!isAuthorizedAdminRequest(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const gatewayStub = getGatewaySessionStub(env);
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/admin/gateway/status") {
    return gatewayStub.fetch("https://gateway-session/status");
  }

  if (request.method === "POST" && url.pathname === "/admin/gateway/start") {
    return startGatewaySession(env);
  }

  return new Response("Method not allowed", { status: 405 });
}

function startGatewaySession(env: Env): Promise<Response> {
  return getGatewaySessionStub(env).fetch("https://gateway-session/start", {
    method: "POST",
  });
}

function getGatewaySessionStub(env: Env): DurableObjectStub {
  const gatewayId = env.GATEWAY_SESSION_DO.idFromName("gateway-session");
  return env.GATEWAY_SESSION_DO.get(gatewayId);
}

function isAuthorizedAdminRequest(request: Request, env: Env): boolean {
  if (!env.ADMIN_AUTH_SECRET) {
    return true;
  }

  const authorization = request.headers.get("Authorization");
  return authorization === `Bearer ${env.ADMIN_AUTH_SECRET}`;
}
