export interface Env {
  DISCORD_BOT_TOKEN: string;
  ADMIN_AUTH_SECRET?: string;
  GATEWAY_SESSION_DO: DurableObjectNamespace;
  MODERATION_STORE_DO: DurableObjectNamespace;
}
