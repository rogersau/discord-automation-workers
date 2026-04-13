# Discord Reaction Moderator

A Cloudflare-first Discord reaction moderator built on **SQLite-backed Durable Objects**. The Worker provisions its moderation store and gateway session on deploy, keeps the Discord Gateway connection inside Cloudflare, and stays free-tier-compatible.

## What this deploy gives you

- **SQLite Durable Object moderation store** for blocklist state
- **Gateway session Durable Object** that connects to Discord from Cloudflare
- **Signed `/interactions` endpoint** for Discord slash commands
- **Automatic slash command sync** before each bootstrap when `DISCORD_APPLICATION_ID` is set
- **Automatic gateway bootstrap** on a scheduled trigger after deploy
- **Admin APIs** for blocklist reads/writes and gateway status/start
- **No KV namespace setup** and no external reaction relay required

The required setup is adding your Discord token, configuring the public application values, and registering the Worker URL as the Discord interactions endpoint.

## Architecture

- `ModerationStoreDO` stores blocked emojis and app config in SQLite.
- `GatewaySessionDO` maintains the Discord Gateway connection, resumes sessions, and applies moderation to `MESSAGE_REACTION_ADD` events.
- The public Worker exposes `/health`, `/interactions`, `/admin/blocklist`, `/admin/gateway/status`, and `/admin/gateway/start`.

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- A Discord application with a bot token

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers).
2. Create an application and a bot user.
3. Copy the bot token for `DISCORD_BOT_TOKEN`.
4. Copy the bot user ID for `BOT_USER_ID`.
5. Copy the application ID for `DISCORD_APPLICATION_ID`.
6. Copy the public key for `DISCORD_PUBLIC_KEY`.
7. Invite the bot with at least the **Manage Messages** permission.

The gateway session requests the `GUILDS` and `GUILD_MESSAGE_REACTIONS` intents. No privileged intents are required for the current moderation flow.

### 3. Configure Wrangler variables and secrets

Set the non-secret Discord values in `wrangler.toml`:

```toml
[vars]
BOT_USER_ID = "123456789012345678"
DISCORD_PUBLIC_KEY = "your-discord-public-key"
DISCORD_APPLICATION_ID = "123456789012345678"
```

Then add the runtime secrets:

```bash
wrangler secret put DISCORD_BOT_TOKEN

# Optional: require bearer auth for admin routes.
wrangler secret put ADMIN_AUTH_SECRET
```

### 4. Deploy

```bash
npm run deploy
```

Deploy provisions:

- `ModerationStoreDO`
- `GatewaySessionDO`
- SQLite migrations for both Durable Objects
- a five-minute cron trigger that bootstraps the gateway session automatically

### 5. Configure the Discord interactions endpoint

In the Discord Developer Portal, open your application and set **Interactions Endpoint URL** to:

```text
https://your-worker-url.workers.dev/interactions
```

Discord will validate the endpoint using `DISCORD_PUBLIC_KEY`. This is a one-time setup per deployed URL. If you change your Worker URL, update the endpoint in Discord.

### 6. Verify gateway startup and command sync

After `DISCORD_BOT_TOKEN` is present, the scheduled bootstrap will start the gateway session automatically within five minutes. If `DISCORD_APPLICATION_ID` is also configured, the Worker first syncs `SLASH_COMMAND_DEFINITIONS` to Discord with the application commands REST API and then starts the gateway session.

To check status:

```bash
curl https://your-worker-url.workers.dev/admin/gateway/status
```

To force an immediate start instead of waiting for the next scheduled bootstrap:

```bash
curl -X POST https://your-worker-url.workers.dev/admin/gateway/start
```

That admin bootstrap path uses the same command-sync-first flow as the scheduled bootstrap.

If `ADMIN_AUTH_SECRET` is configured, include it as a bearer token on admin requests:

```bash
curl https://your-worker-url.workers.dev/admin/gateway/status \
  -H "Authorization: Bearer $ADMIN_AUTH_SECRET"
```

If command sync fails, the Worker logs the sync error but still attempts to start the gateway session.

## Slash commands

Once the interactions endpoint is configured and a bootstrap has run successfully, Discord will expose:

- `/blocklist add emoji:<emoji>` — block an emoji in the current server
- `/blocklist remove emoji:<emoji>` — unblock an emoji in the current server

Examples:

```text
/blocklist add emoji:✅
/blocklist remove emoji:✅
```

Only members with **Administrator** or **Manage Guild** permissions can use the commands.

## Managing the blocklist

### View the current blocklist

```bash
curl https://your-worker-url.workers.dev/admin/blocklist
```

### Add a blocked emoji

```bash
curl -X POST https://your-worker-url.workers.dev/admin/blocklist \
  -H "Content-Type: application/json" \
  -d '{"emoji":"✅","action":"add"}'
```

### Remove a blocked emoji

```bash
curl -X POST https://your-worker-url.workers.dev/admin/blocklist \
  -H "Content-Type: application/json" \
  -d '{"emoji":"✅","action":"remove"}'
```

If admin auth is enabled:

```bash
curl -X POST https://your-worker-url.workers.dev/admin/blocklist \
  -H "Authorization: Bearer $ADMIN_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"emoji":"✅","action":"add"}'
```

## Admin API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Basic health check |
| POST | `/interactions` | Discord interactions callback endpoint |
| GET | `/admin/blocklist` | Return the effective moderation config |
| POST / PUT | `/admin/blocklist` | Add or remove blocked emojis |
| GET | `/admin/gateway/status` | Return current gateway session state |
| POST | `/admin/gateway/start` | Force an immediate command sync + gateway bootstrap |

If `ADMIN_AUTH_SECRET` is configured, all `/admin/*` routes require `Authorization: Bearer <secret>`.

## Default blocked emojis

These emojis are seeded into a brand-new moderation store:

- 🏳️‍🌈
- 🏳️‍⚧️
- 🏳️
- 🟤
- 🏴
- 🏴‍☠️
- ☣️
- 🔞
- 🍎

## Local validation

```bash
npm test
npm run typecheck
npx wrangler deploy --dry-run
```

## Project structure

```text
├── src/
│   ├── durable-objects/
│   │   ├── gateway-session.ts
│   │   └── moderation-store.ts
│   ├── blocklist.ts
│   ├── discord.ts
│   ├── env.ts
│   ├── gateway.ts
│   ├── index.ts
│   ├── reaction-moderation.ts
│   └── types.ts
├── test/
├── wrangler.toml
├── package.json
└── README.md
```

## License

MIT
