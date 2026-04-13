# Discord Reaction Moderator

A Cloudflare-first Discord reaction moderator built on **SQLite-backed Durable Objects**. The Worker provisions its moderation store and gateway session on deploy, keeps the Discord Gateway connection inside Cloudflare, and stays free-tier-compatible.

## What this deploy gives you

- **SQLite Durable Object moderation store** for blocklist state
- **Gateway session Durable Object** that connects to Discord from Cloudflare
- **Automatic gateway bootstrap** on a scheduled trigger after deploy
- **Admin APIs** for blocklist reads/writes and gateway status/start
- **No KV namespace setup** and no external reaction relay required

The only required post-deploy setup is adding your Discord token and any bot-specific identifiers you do not want committed.

## Architecture

- `ModerationStoreDO` stores blocked emojis and app config in SQLite.
- `GatewaySessionDO` maintains the Discord Gateway connection, resumes sessions, and applies moderation to `MESSAGE_REACTION_ADD` events.
- The public Worker exposes `/health`, `/admin/blocklist`, `/admin/gateway/status`, and `/admin/gateway/start`.

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
5. Invite the bot with at least the **Manage Messages** permission.

The gateway session requests the `GUILDS` and `GUILD_MESSAGE_REACTIONS` intents. No privileged intents are required for the current moderation flow.

### 3. Configure Wrangler variables and secrets

Set `BOT_USER_ID` in `wrangler.toml`:

```toml
[vars]
BOT_USER_ID = "123456789012345678"
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

### 5. Verify gateway startup

After the bot token is present, the scheduled bootstrap will start the gateway session automatically within five minutes.

To check status:

```bash
curl https://your-worker-url.workers.dev/admin/gateway/status
```

To force an immediate start instead of waiting for the next scheduled bootstrap:

```bash
curl -X POST https://your-worker-url.workers.dev/admin/gateway/start
```

If `ADMIN_AUTH_SECRET` is configured, include it as a bearer token on admin requests:

```bash
curl https://your-worker-url.workers.dev/admin/gateway/status \
  -H "Authorization: Bearer $ADMIN_AUTH_SECRET"
```

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
| GET | `/admin/blocklist` | Return the effective moderation config |
| POST / PUT | `/admin/blocklist` | Add or remove blocked emojis |
| GET | `/admin/gateway/status` | Return current gateway session state |
| POST | `/admin/gateway/start` | Force an immediate gateway bootstrap |

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
