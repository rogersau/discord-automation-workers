import type { Env } from "../env";
import { createRuntimeApp } from "./app";
import { createCloudflareContext } from "./cloudflare-context";

export function createCloudflareRuntime(env: Env) {
  const context = createCloudflareContext(env);
  return createRuntimeApp(context);
}
