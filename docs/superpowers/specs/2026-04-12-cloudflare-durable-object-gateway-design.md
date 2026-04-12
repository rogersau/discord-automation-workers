# Cloudflare Durable Object Gateway Design

## Problem

This project currently runs as a single Cloudflare Worker with Cloudflare KV for moderation state and expects Discord reaction events to be forwarded in from an external relay. The goal is to make the project Cloudflare-first: deployment should provision the Worker and Durable Objects in one step, moderation state should move to a free-tier-compatible SQLite-backed Durable Object, and Discord Gateway handling should run inside Cloudflare. Manual setup after deploy is limited to entering Discord secrets.

## Scope

This design targets a single Discord bot running on a single Gateway shard. It preserves the existing moderation behavior and admin HTTP surface while replacing KV with SQLite-backed Durable Objects and moving Gateway ingestion into Cloudflare.

Out of scope:

- Multi-shard orchestration
- Rewriting the product into an interactions-only Discord app
- Eliminating post-deploy secret entry

## Chosen Approach

Use two Durable Objects with distinct responsibilities:

1. `GatewaySessionDO` manages the Discord Gateway websocket lifecycle.
2. `ModerationStoreDO` manages moderation and app configuration in SQLite.
3. The public Worker remains the HTTP entry point for health checks, admin APIs, and gateway bootstrap/status operations.

Both Durable Objects are addressed as stable singleton instances so the application has one gateway coordinator and one moderation store for the bot.

This is preferred over a single monolithic Durable Object because it keeps long-lived connection logic separate from the moderation database and makes failures easier to reason about.

## Architecture

### Worker

The Worker remains the public interface and owns:

- `/health`
- `/admin/blocklist`
- Optional gateway control/status routes such as `/admin/gateway/start` and `/admin/gateway/status`
- Auth checks for admin routes
- Bootstrap logic that ensures the Gateway Durable Object is started after deployment

The Worker does not manage SQLite directly. It talks to `ModerationStoreDO` and `GatewaySessionDO` through Durable Object stubs.

### GatewaySessionDO

`GatewaySessionDO` is a singleton coordination object for the Discord Gateway connection. Its responsibilities:

- Open and maintain the websocket connection to Discord Gateway
- Handle `HELLO`, `IDENTIFY`, `RESUME`, heartbeat, reconnect, and invalid-session flows
- Persist gateway session metadata needed for recovery
- Normalize relevant incoming events and dispatch moderation decisions
- Expose lightweight status/control methods to the Worker

### ModerationStoreDO

`ModerationStoreDO` is a singleton SQLite-backed store for application state. Its responsibilities:

- Store global blocked emojis
- Store per-guild moderation enablement and guild-specific blocked emojis
- Store small app configuration values when needed
- Return an effective moderation config for a given guild
- Apply admin API writes atomically through SQLite

## Runtime Flow

### Bootstrap Flow

1. Deploy provisions the Worker and Durable Object classes through Wrangler configuration and migrations.
2. The operator sets required Discord secrets after deploy.
3. A gateway bootstrap request, or a lazy startup path, tells `GatewaySessionDO` to start.
4. `GatewaySessionDO` loads any previously saved session state and connects to the Discord Gateway.

### Reaction Moderation Flow

1. Discord sends `MESSAGE_REACTION_ADD` through the Gateway websocket.
2. `GatewaySessionDO` filters to the event types this application cares about.
3. The event is normalized into the current internal reaction shape.
4. The moderation path reads the effective rules from `ModerationStoreDO`.
5. If the emoji is blocked for the relevant guild, shared Discord REST helper code removes the reaction.
6. If the emoji is not blocked, the event is ignored.

### Admin Flow

1. The operator calls `/admin/blocklist`.
2. The Worker validates auth and request shape.
3. Reads and writes are performed through `ModerationStoreDO`.
4. The updated effective configuration is returned as JSON.

### Gateway Status Flow

An admin status route can ask `GatewaySessionDO` for current state such as:

- `idle`
- `connecting`
- `ready`
- `resuming`
- `backoff`

This gives operators a simple way to see whether the bot is connected after deployment.

## Persistence Model

### ModerationStoreDO SQLite Schema

Proposed tables:

- `global_blocked_emojis(normalized_emoji TEXT PRIMARY KEY)`
- `guild_settings(guild_id TEXT PRIMARY KEY, moderation_enabled INTEGER NOT NULL DEFAULT 1)`
- `guild_blocked_emojis(guild_id TEXT NOT NULL, normalized_emoji TEXT NOT NULL, PRIMARY KEY (guild_id, normalized_emoji))`
- `app_config(key TEXT PRIMARY KEY, value TEXT NOT NULL)`

`ModerationStoreDO` is the single source of truth for moderation state. The Worker and `GatewaySessionDO` do not write moderation data outside this object.

### GatewaySessionDO Persistent State

`GatewaySessionDO` stores only connection-recovery metadata:

- Connection status
- Session ID
- Resume URL
- Last sequence number
- Backoff metadata
- Last error metadata when useful for status reporting

This keeps recovery state separate from the moderation schema and reduces accidental coupling between the websocket lifecycle and application data.

## Error Handling

### Gateway Failures

- Disconnects are treated as operational events, not fatal crashes.
- Resume is attempted when Discord provides resumable state.
- Invalid sessions fall back to a fresh identify flow.
- Reconnect attempts use persisted exponential backoff to avoid tight retry loops after object restarts.

### Admin Failures

- Invalid JSON or missing required fields return `400`.
- Unsupported actions return `400`.
- Unauthorized admin requests return `401`.
- Unsupported methods return `405`.

### External API Failures

- Discord REST failures when removing reactions are logged explicitly.
- Storage failures are surfaced as real failures rather than silently returning success-shaped responses.
- Status routes should make operational state visible without requiring log inspection for every issue.

## Deployment and Free-Tier Compatibility

- Durable Object storage uses the SQLite backend, which is compatible with the Cloudflare Workers free tier.
- Wrangler configuration declares Durable Object bindings and migrations so a single deploy provisions the runtime pieces.
- The only required post-deploy manual setup is adding Discord secrets and any bot-specific identifiers that cannot be committed to the repository.

## Verification Strategy

- Preserve the current admin API shape while swapping KV-backed storage for `ModerationStoreDO`.
- Type-check the refactored TypeScript Worker.
- Validate Cloudflare configuration for Durable Object bindings and migrations.
- Confirm the deployment path remains Cloudflare-first and does not depend on manual namespace creation.
- Add focused tests for blocking/normalization behavior only if the repository already has a test harness; otherwise avoid introducing a new testing stack as part of this refactor.

## Notes

- Single-shard support is an intentional constraint for the first version.
- The separation between gateway lifecycle and moderation storage is the main architectural decision. It is intended to keep the system understandable, recoverable, and easier to extend later.
