# discord.js feasibility design

## Problem

The application currently owns a small Discord integration seam:

- `src/discord/*` wraps Discord REST endpoints with typed fetch helpers
- `src/gateway.ts` builds gateway identify, resume, heartbeat, and dispatch decisions
- `GatewaySessionDO` owns the Cloudflare Durable Object WebSocket lifecycle
- interaction verification remains implemented directly with Web Crypto

This keeps the production shape Cloudflare-native, but it also means the project maintains Discord API request shapes, response types, command payloads, and gateway details directly. The question is whether adopting `discord.js` would reduce that maintenance burden without breaking the Cloudflare Worker deployment model.

## Current context

The production runtime is one Cloudflare Worker with Durable Objects and R2:

- `wrangler.toml` points `main` at `src/index.ts`
- `GATEWAY_SESSION_DO` manages Discord gateway state
- `MODERATION_STORE_DO` manages persistence
- `TICKET_TRANSCRIPTS_BUCKET` stores ticket transcript artifacts
- `tsconfig.json` targets ES2022, `moduleResolution: "bundler"`, and Cloudflare Worker types

The current Discord seam is used by:

- reaction moderation, for deleting blocked reactions
- timed roles, for member role add/remove
- tickets, for channels, messages, transcripts, and cleanup
- admin APIs, for guild, channel, role, and permission data
- gateway bootstrap, for slash-command sync

`discord.js` version `14.26.3` currently depends on `@discordjs/ws`, `@discordjs/rest`, `@discordjs/builders`, `discord-api-types`, `undici`, and other packages. Its gateway package stack is designed for Node-style persistent clients and includes WebSocket dependencies that do not naturally match the existing Cloudflare Durable Object gateway lifecycle.

## Scope

In scope:

- Evaluate whether selective packages from the discord.js ecosystem can replace parts of the hand-written seam.
- Preserve the existing Cloudflare Worker and Durable Object deployment model.
- Keep the current gateway Durable Object as the owner of gateway lifecycle unless a separate Node runtime is explicitly chosen later.
- Identify concrete go/no-go checks before changing production dependencies.
- Document migration cost and risk by integration surface.

Out of scope:

- Replacing the Worker deployment with a Node bot process in this phase.
- Rewriting gateway dispatch around a full `discord.js` `Client`.
- Changing product behavior for moderation, tickets, timed roles, admin APIs, or slash commands.
- Adding dependencies before compatibility is proven.

## Options considered

### 1. Full `discord.js` client migration

Move gateway handling and REST operations to a long-lived `discord.js` `Client`.

**Pros**

- Strongest alignment with the mainstream Discord bot ecosystem.
- Reduces custom gateway and REST code the most.
- Provides high-level event and resource abstractions.

**Cons**

- Conflicts with the current Cloudflare Worker and Durable Object architecture.
- Introduces a long-lived Node process assumption that the project does not currently operate.
- Pulls in gateway and WebSocket dependencies that need Node compatibility rather than only Worker APIs.
- Would require new hosting, deployment, lifecycle, and monitoring decisions.

### 2. Selective discord.js ecosystem adoption

Keep the Cloudflare runtime and gateway Durable Object, but evaluate targeted packages:

- `discord-api-types` for API payload and response types
- `@discordjs/builders` for slash commands, message components, embeds, and related payload construction
- `@discordjs/rest` only if it bundles cleanly and behaves correctly in Workers

**Pros**

- Preserves the working Cloudflare deployment model.
- Reduces the highest-value parts of the custom seam without forcing a runtime rewrite.
- Allows package-by-package proof before committing to a migration.
- Keeps gateway lifecycle code aligned with Durable Object constraints.

**Cons**

- Does not eliminate all custom Discord integration code.
- May still reveal bundle, runtime, or dependency compatibility issues.
- Requires adapter design so product code does not depend directly on third-party library shapes.

### 3. Keep the custom seam and strengthen it

Do not adopt discord.js packages. Improve local typed clients and tests around the current fetch-based seam.

**Pros**

- Lowest runtime and dependency risk.
- Keeps bundle size and Worker compatibility predictable.
- Matches the current small set of Discord API operations.

**Cons**

- Continues local ownership of Discord payload and response definitions.
- Misses ecosystem-maintained command builders and API type updates.
- Leaves future Discord API changes entirely on this project to track.

## Selected approach

Use option 2 as the feasibility target: selective discord.js ecosystem adoption.

The project should not move to the full `discord.js` client unless the team explicitly chooses to introduce a separate Node bot runtime. For the current architecture, `discord.js` should be treated as an ecosystem of potentially useful packages, not as a wholesale replacement for the Cloudflare gateway and runtime seams.

## Target architecture

### Runtime stance

The runtime remains:

- one Cloudflare Worker entrypoint
- `GatewaySessionDO` as the gateway lifecycle owner
- HTTP interaction routes for Discord interactions
- Durable Objects and R2 for stateful backend concerns

Any discord.js ecosystem package must fit this runtime. If a package requires Node-only APIs, process-level lifecycle assumptions, or incompatible WebSocket behavior, it is excluded from Worker production code.

### Adapter boundary

Product code should continue to depend on local application-level functions or ports, not raw third-party package objects. The current surfaces are a reasonable starting point:

- command sync
- message create/list/upload/delete
- channel create/delete
- guild resource listing
- member role mutation
- reaction deletion
- interaction signature verification
- gateway payload construction and dispatch filtering

Selective package adoption should happen behind these boundaries. This keeps a future rollback to fetch-based helpers possible and prevents discord.js package shapes from leaking into services, routes, or Durable Objects.

### Package candidates

#### `discord-api-types`

Most likely to be safe and valuable. It can replace locally defined Discord resource and payload interfaces without changing runtime behavior.

Go/no-go checks:

- TypeScript accepts the package under the Worker tsconfig.
- Types improve or preserve current strictness.
- No runtime import is required for type-only usage.
- Existing tests still cover payload assumptions that matter to product behavior.

#### `@discordjs/builders`

Potentially useful for slash-command definitions, embeds, components, and message payload construction.

Go/no-go checks:

- Worker build succeeds without Node compatibility flags.
- Bundle growth is acceptable for the Worker.
- Builders produce the same payloads currently expected by tests and Discord endpoints.
- The code remains readable when wrapped behind local helper functions.

#### `@discordjs/rest`

Possible but higher risk than type/builders adoption. It may duplicate the current small fetch wrapper while adding queueing and dependency behavior that must be validated in Workers.

Go/no-go checks:

- Worker build succeeds without Node-only polyfills.
- Runtime requests work in `wrangler dev`.
- Error handling can preserve the current explicit failure behavior.
- Rate-limit behavior is understood and does not hide failures from callers.
- The wrapper can be isolated so the project can fall back to direct fetch helpers.

#### Full `discord.js` and `@discordjs/ws`

Not a target for the Cloudflare Worker path. These should only be considered if the project intentionally designs a separate Node-hosted bot process.

## Feasibility investigation plan

1. Build a dependency matrix for `discord-api-types`, `@discordjs/builders`, and `@discordjs/rest`.
2. Add each candidate in isolation on a feature branch or worktree.
3. Run the existing `pnpm run typecheck` and `pnpm test` suite after each candidate.
4. Use `wrangler dev` or an equivalent Worker build check for any runtime package.
5. For builders, snapshot or assert representative command/message/component payloads against current outputs.
6. For REST, exercise one low-risk endpoint through the local adapter in a development environment.
7. Record bundle/runtime failures as package-specific blockers instead of forcing polyfills.

## Migration strategy if feasible

Migration should be incremental:

1. Adopt `discord-api-types` for type-only imports where it directly replaces local Discord resource types.
2. Adopt builders for slash-command definitions or message/component payloads if generated payloads remain stable.
3. Evaluate `@discordjs/rest` only after type/builders adoption succeeds.
4. Keep the existing gateway Durable Object unchanged.
5. Keep interaction signature verification local unless a Worker-compatible package clearly improves it.
6. Preserve local adapter functions so callers do not change when implementation details change.

## Error handling

The current code throws explicit errors for failed Discord requests and avoids silent success-shaped fallbacks. Any adopted package must preserve that behavior:

- failed REST calls must surface status and response details where available
- invalid Discord payload construction should fail before sending requests
- gateway message parse failures should remain visible through gateway status
- compatibility failures during investigation should block adoption rather than be hidden with broad catches

## Testing

The feasibility work should rely on existing verification commands:

- `pnpm run typecheck`
- `pnpm test`

Additional targeted tests should be added only where package adoption changes payload construction or adapter behavior. Useful targets include:

- slash-command payload equivalence
- ticket message/component payload equivalence
- Discord REST adapter error mapping
- type-level replacement of local Discord resource shapes

## Decision criteria

Selective adoption is approved only if it meets all of these criteria:

- the Worker build and typecheck pass without Node-only polyfills
- behavior remains equivalent at the local adapter boundary
- dependency and bundle cost are justified by reduced local maintenance
- rollback remains straightforward because application code depends on local adapters
- gateway lifecycle stays Cloudflare-native

If those criteria fail, the project should keep the custom fetch seam and improve its types/tests instead of forcing discord.js into the Worker runtime.
