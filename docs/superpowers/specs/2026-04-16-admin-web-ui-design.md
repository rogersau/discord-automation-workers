# Admin Web UI Design

## Problem

This project already has a Worker-based operator surface for gateway control, but it is still managed through HTTP endpoints intended for curl-style use. The goal of this phase is to replace that manual flow with a simple password-protected web interface that becomes the primary operator experience for gateway control, app config updates, and guild blocklist management.

## Scope

This design adds a first-pass admin UI with three responsibilities:

1. Show gateway status and allow a start or re-run bootstrap action
2. View and edit app config values stored in `ModerationStoreDO`
3. Manage blocked emojis for one guild at a time after entering a guild ID

This version uses a single shared password stored as a secret, a login form, and a browser session cookie.

Out of scope:

- Replacing slash commands with UI flows
- Multi-user accounts or role-based access control
- A multi-guild dashboard view
- Timed role management in the first UI
- A separate frontend deployment or framework migration

## Chosen Approach

Serve the admin UI directly from the same Worker and back it with session-protected admin routes owned by that Worker.

This is preferred over a bundled SPA or a separate external dashboard because:

- the repository is already Worker-first
- deployment stays as one artifact
- no frontend build stack needs to be introduced for v1
- the UI can reuse the current Durable Object data model without inventing a second backend
- the browser replaces curl as the supported operator surface

## Architecture

### Worker surface

The Worker gains two kinds of admin routes:

1. page routes such as `/admin/login` and `/admin`
2. session-protected dashboard data routes under `/admin/api/*`

Public routes remain limited to:

- `/health`
- `/interactions`

All other admin behavior moves behind the password-protected UI. The current bearer-token-based curl management flow is deprecated in favor of browser-driven management. The dashboard API still uses HTTP internally because the page needs a server interface, but it is no longer designed as a human-operated curl surface.

### Durable Objects

`ModerationStoreDO` remains the source of truth for:

- app config key/value data
- guild-scoped blocked emoji state

`GatewaySessionDO` remains the source of truth for gateway lifecycle state.

The UI layer should call focused Worker handlers, which in turn continue to use Durable Object stubs. The first web UI should not bypass the existing runtime composition by writing storage directly from page handlers.

## Authentication Design

### Login model

Authentication uses a single shared password stored as a Worker secret separate from the Discord secrets. The login form posts the submitted password to the Worker. On success, the Worker issues a signed, HTTP-only session cookie and redirects the operator to `/admin`.

The session cookie should be:

- HTTP-only
- `SameSite=Strict`
- `Secure` in deployed environments
- bounded by an explicit expiration time

The cookie payload should be signed so the Worker can validate it without storing server-side session rows for the first version.

### Authorization behavior

Unauthenticated browser navigations to `/admin` should redirect to `/admin/login`.

Unauthenticated calls to `/admin/api/*` should return `401` JSON responses so the dashboard can surface a clear “session expired” message and send the operator back to login.

There is no second operator auth path for v1. The password-protected web interface becomes the supported admin experience.

## Dashboard Design

### Layout

The first version should stay intentionally plain and server-owned:

1. a login page
2. a single dashboard page with a few focused cards or sections

The dashboard contains:

- **Gateway**: current state plus a start or re-run bootstrap action
- **App config**: list existing config entries and allow targeted edits
- **Guild blocklist**: enter a guild ID, load that guild's blocked emojis, add an emoji, remove an emoji

The page can use lightweight client-side JavaScript for fetch calls and UI refreshes, but the UI should stay simple enough that it can be rendered and maintained without a frontend framework.

### Guild blocklist workflow

The first blocklist workflow is single-guild by design:

1. operator enters a guild ID
2. dashboard loads the current blocked emoji list for that guild
3. operator adds or removes one emoji at a time
4. dashboard refreshes the visible list and shows an explicit result message

This keeps the first page small while still making the most common moderation update path available without slash commands or curl.

## Route and Interface Changes

### New page routes

Add page routes such as:

- `GET /admin/login`
- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin`

### New dashboard API routes

Add session-protected JSON routes such as:

- `GET /admin/api/gateway/status`
- `POST /admin/api/gateway/start`
- `GET /admin/api/config`
- `POST /admin/api/config`
- `GET /admin/api/blocklist?guildId=<id>`
- `POST /admin/api/blocklist`

Representative blocklist mutation body:

```json
{
  "guildId": "123",
  "emoji": "✅",
  "action": "add"
}
```

The exact route names can vary, but the split between page routes and dashboard API routes should stay clear.

### Existing admin routes

The old curl-oriented admin routes should no longer be the supported operator interface once the dashboard exists. Documentation should point operators to the web UI instead of curl examples, and the bearer-token admin route model should be removed from the public management story.

## Runtime Flow

### Login

1. Operator visits `/admin/login`
2. Worker returns the login page
3. Operator submits the shared password
4. Worker validates the password against the configured secret
5. Worker sets the signed session cookie and redirects to `/admin`

### Dashboard load

1. Operator visits `/admin`
2. Worker validates the session cookie
3. Worker returns the dashboard shell
4. Client-side fetches load gateway status, config data, and guild blocklist data as needed

### Gateway control

1. Operator presses the start or re-run bootstrap control
2. Dashboard posts to the session-protected gateway action route
3. Worker invokes the existing gateway bootstrap/start path
4. Dashboard refreshes status and shows the result

### Config and blocklist changes

1. Operator edits a config value or submits a blocklist change
2. Dashboard posts to a session-protected route
3. Worker validates input and forwards the mutation to `ModerationStoreDO`
4. Worker returns the updated data or a precise error
5. Dashboard updates the visible state

## Error Handling

### Authentication errors

- Wrong password returns a clear login error without issuing a cookie
- Missing or invalid session cookie redirects page requests to login
- Expired session on API requests returns `401` JSON

### Validation errors

- Missing guild ID returns a clear operator-facing error
- Invalid emoji input returns a clear operator-facing error
- Invalid config keys or values return explicit validation failures

### Runtime errors

- Durable Object failures are logged and returned as generic operator-safe messages
- Gateway start failures surface the failure to the dashboard instead of pretending success
- Duplicate add and missing remove blocklist cases should remain explicit no-op messages, matching the current command behavior

## Verification Strategy

Add focused coverage for:

1. login success and failure
2. session cookie validation and protected route gating
3. dashboard API behavior for gateway status and start
4. config reads and writes
5. guild blocklist reads and mutations for a selected guild
6. unauthorized responses for expired or missing sessions

Repository validation remains:

- `pnpm test`
- `pnpm run typecheck`

## Notes

- The first UI should stay intentionally plain and dependency-light.
- The browser becomes the normal operator interface for management work.
- Slash commands remain useful for in-Discord server administration, but the new web UI replaces the old curl-based operator workflow.
