# Timed Roles Design

## Problem

The bot needs a new `/timedrole` slash command group so guild admins can temporarily assign a pre-configured Discord role to a member for a fixed duration such as `1h`, `1w`, or `1m`, inspect active timed roles, and remove them early. The role itself is managed in Discord and is expected to remove message-posting access while still allowing ticket creation. Timed-role expiries must survive deploys and restarts.

## Goals

- Add a guild-only `/timedrole` command group with `add`, `remove`, and `list` subcommands.
- Restrict usage to members with Administrator or Manage Guild permissions.
- Add the requested Discord role immediately when the command succeeds.
- Allow admins to remove an active timed role early.
- Allow admins to list active timed roles in the current guild.
- Persist timed-role assignments so expiry still happens after restarts or deploys.
- Replace an existing active timed-role assignment for the same guild, user, and role when the command is run again.
- Remove expired roles automatically.

## Non-Goals

- Managing channel permission overwrites or ticket-system permissions.
- Creating or configuring the Discord role itself.
- Supporting arbitrary duration syntax beyond the requested `h`, `w`, and `m` units.

## Recommended Architecture

Use the existing worker as the slash-command entrypoint and extend `ModerationStoreDO` to store timed-role assignments.

### Worker

- Extend `SLASH_COMMAND_DEFINITIONS` with a top-level `timedrole` command that mirrors the existing subcommand style used by `/blocklist`.
- Parse the application command payload and validate:
  - guild context exists
  - invoker has Administrator or Manage Guild permissions
  - required options for the chosen subcommand are present
  - duration format is valid for `add`
- Call `ModerationStoreDO` to upsert, list, or delete timed-role assignments.
- Call the Discord REST API to add or remove the role for `add` and `remove`.
- Return explicit ephemeral success or failure messages.

### ModerationStoreDO

Add a `timed_roles` table with one row per active guild/user/role assignment:

- `guild_id TEXT NOT NULL`
- `user_id TEXT NOT NULL`
- `role_id TEXT NOT NULL`
- `duration_input TEXT NOT NULL`
- `expires_at_ms INTEGER NOT NULL`
- `created_at_ms INTEGER NOT NULL`
- `updated_at_ms INTEGER NOT NULL`
- `PRIMARY KEY (guild_id, user_id, role_id)`

Add timed-role endpoints/helpers for:

- upserting an assignment
- reading one active assignment by guild, user, and role
- listing active assignments for a guild
- reading the next pending expiry
- listing expired assignments
- deleting assignments after successful manual removal or expiry processing

`ModerationStoreDO` should use a Durable Object alarm. After every upsert or expiry pass, it should schedule the next alarm for the earliest `expires_at_ms` still in storage.

## Command Behavior

`/timedrole` should follow the same command-group pattern as `/blocklist`:

- `/timedrole add user:<member> role:<role> duration:<text>`
- `/timedrole remove user:<member> role:<role>`
- `/timedrole list`

### Add

`/timedrole add` acts as an upsert for the exact guild + user + role combination.

- If no active assignment exists, create one.
- If one already exists, replace its expiry with the newly requested duration.
- Success response example: `Assigned @Muted to @User for 1w.`
- Include an expiry hint in the response when available.

Duration parsing rules:

- `1h` = one hour
- `1w` = one week
- `1m` = one month

The command should reject malformed durations before touching storage.

### Remove

`/timedrole remove` should:

- find the exact guild + user + role assignment
- remove the Discord role from the member immediately
- delete the timed-role entry if the Discord removal succeeds
- return a no-op message if that timed role is not currently active

### List

`/timedrole list` should return an ephemeral view of active timed roles for the current guild.

Each entry should include enough information for an admin to act on it:

- member
- role
- original duration input when useful
- expiry time or relative remaining time

## Expiry Flow

### On add

1. Validate the Discord interaction and parse the command.
2. Parse the duration into `expires_at_ms`.
3. Upsert the timed-role row in `ModerationStoreDO`.
4. Add the Discord role to the member through the Discord API.
5. If the role add fails, immediately delete the just-upserted row before returning the failure response.
6. Return an ephemeral confirmation message on success.

### On remove

1. Validate the Discord interaction and parse the command.
2. Look up the exact active assignment for the guild, user, and role.
3. If it does not exist, return an explicit ephemeral no-op response.
4. Remove the Discord role from the member through the Discord API.
5. If the role removal succeeds, delete the timed-role row.
6. Return an ephemeral confirmation message on success.

### On list

1. Validate the Discord interaction and parse the command.
2. Read all active timed-role rows for the current guild.
3. Sort them by soonest expiry first.
4. Return an ephemeral formatted list, or an explicit empty-state message if none exist.

### On expiry

1. `ModerationStoreDO` alarm fires at the next known expiry.
2. The DO selects all rows with `expires_at_ms <= now`.
3. For each expired row, remove the role through the Discord API.
4. Delete only the rows whose Discord role removal succeeded.
5. Keep failed removals in storage so the next alarm retries them.
6. Re-arm the alarm for the next soonest expiry still stored.

## Error Handling

- Invalid duration input returns an ephemeral validation error.
- Unsupported command payloads return an ephemeral unsupported-command response.
- Missing guild context returns the existing guild-only command error.
- Discord role-add failures return an explicit ephemeral failure response and roll back the just-created assignment row.
- Manual remove failures return an explicit ephemeral failure response and leave the assignment row intact for retry or inspection.
- Discord role-remove failures during expiry are logged and retried by keeping the row.
- Duplicate invocations are handled deterministically by replacing the existing expiry.
- Manual remove on a missing assignment returns an explicit no-op response.

## Testing

Add or extend tests for:

- slash command definitions including the new `timedrole` subcommand tree
- interaction parsing for `add`, `remove`, and `list`
- option parsing for `user`, `role`, and `duration`
- duration parsing and invalid-input rejection
- permission enforcement for the new command
- duplicate replacement behavior
- worker/store integration for successful timed-role add, remove, and list
- `ModerationStoreDO` timed-role upsert and expiry queries
- `ModerationStoreDO` guild-scoped active timed-role listing
- alarm scheduling and re-scheduling behavior
- Discord API helper calls for adding and removing member roles

## Open Decisions Resolved

- The bot only assigns and removes the chosen role. Discord role and channel permissions are pre-configured outside the bot.
- Expiries must persist across restarts and deploys.
- Re-running `/timedrole` for the same user and role replaces the existing expiry.
- `m` means month for this feature.
