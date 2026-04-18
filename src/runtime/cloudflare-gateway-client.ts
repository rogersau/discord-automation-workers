import type { GatewaySnapshot } from "./contracts";

export function createCloudflareGatewayClient(gatewayStub: { fetch: (...args: any[]) => Promise<any> }) {
  return {
    async start(): Promise<GatewaySnapshot> {
      return readJson(gatewayStub.fetch("https://gateway-session/start", { method: "POST" }));
    },
    async status(): Promise<GatewaySnapshot> {
      return readJson(gatewayStub.fetch("https://gateway-session/status"));
    },
  };
}

async function readJson(responsePromise: Promise<unknown>): Promise<any> {
  const response = await responsePromise as Response;
  if (!response.ok) {
    throw new Error(`Cloudflare gateway request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}
