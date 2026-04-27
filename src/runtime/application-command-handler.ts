import { normalizeEmoji } from "../blocklist";
import {
  addGuildMemberRole,
  removeGuildMemberRole,
} from "../discord";
import {
  buildEphemeralMessage,
  extractCommandInvocation,
  hasGuildAdminPermission,
} from "../discord-interactions";
import {
  describeTimedRoleAssignmentFailure,
  formatTimedRoleExpiry,
  parseTimedRoleDuration,
} from "../timed-roles";
import type { RuntimeStore } from "./contracts";
import type { DiscordInteraction } from "./app-types";

const DISCORD_MESSAGE_CONTENT_LIMIT = 2_000;

export async function handleApplicationCommand(
  interaction: DiscordInteraction,
  store: RuntimeStore,
  discordBotToken: string
): Promise<Response> {
  if (typeof interaction?.guild_id !== "string" || interaction.guild_id.length === 0) {
    return Response.json(buildEphemeralMessage("This command can only be used inside a server."));
  }
  if (!hasGuildAdminPermission(interaction?.member?.permissions ?? "")) {
    return Response.json(
      buildEphemeralMessage("You need Administrator or Manage Guild permissions to use this command.")
    );
  }

  const invocation = extractCommandInvocation(interaction);
  if (!invocation) {
    return Response.json(buildEphemeralMessage("Unsupported command."));
  }

  if (invocation.commandName === "blocklist" && invocation.subcommandName === "list") {
    try {
      const config = await store.readConfig();
      const guildConfig = config.guilds?.[interaction.guild_id];
      const effectiveEmojis = guildConfig?.enabled === false ? [] : guildConfig?.emojis ?? [];
      const content = formatBoundedBulletList(
        "Blocked emojis in this server:",
        "No emojis are blocked in this server.",
        effectiveEmojis
      );
      return Response.json(buildEphemeralMessage(content));
    } catch (error) {
      console.error("Failed to load moderation config", error);
      return Response.json(buildEphemeralMessage("Failed to load the server blocklist."));
    }
  }

  if (invocation.commandName === "timedrole" && invocation.subcommandName === "list") {
    const assignments = await store.listTimedRolesByGuild(interaction.guild_id);
    const content =
      assignments.length === 0
        ? "No timed roles are active in this server."
        : `Active timed roles:\n${assignments
            .map(
              (assignment) =>
                `- <@${assignment.userId}> -> <@&${assignment.roleId}> (${assignment.durationInput}, expires ${formatTimedRoleExpiry(assignment.expiresAtMs)})`
            )
            .join("\n")}`;
    return Response.json(buildEphemeralMessage(content));
  }

  if (invocation.commandName === "timedrole" && invocation.subcommandName === "add") {
    const parsedDuration = parseTimedRoleDuration(invocation.duration, Date.now());
    if (!parsedDuration) {
      return Response.json(buildEphemeralMessage("Invalid duration. Use values like 1h, 1w, or 1m."));
    }
    await store.upsertTimedRole({
      guildId: interaction.guild_id,
      userId: invocation.userId,
      roleId: invocation.roleId,
      durationInput: parsedDuration.durationInput,
      expiresAtMs: parsedDuration.expiresAtMs,
    });

    try {
      await addGuildMemberRole(
        interaction.guild_id,
        invocation.userId,
        invocation.roleId,
        discordBotToken
      );
    } catch (error) {
      console.error("Timed role assignment failed", error);
      try {
        await store.deleteTimedRole({
          guildId: interaction.guild_id,
          userId: invocation.userId,
          roleId: invocation.roleId,
        });
      } catch (rollbackError) {
        console.error("Timed role rollback failed", rollbackError);
        return Response.json(
          buildEphemeralMessage("Failed to assign the timed role, and rollback failed.")
        );
      }

      return Response.json(
        buildEphemeralMessage(describeTimedRoleAssignmentFailure(error))
      );
    }

    return Response.json(
      buildEphemeralMessage(
        `Assigned <@&${invocation.roleId}> to <@${invocation.userId}> for ${invocation.duration} (${formatTimedRoleExpiry(parsedDuration.expiresAtMs)}).`
      )
    );
  }

  if (invocation.commandName === "timedrole" && invocation.subcommandName === "remove") {
    const assignments = await store.listTimedRolesByGuild(interaction.guild_id);
    const activeAssignment = assignments.find(
      (entry) => entry.userId === invocation.userId && entry.roleId === invocation.roleId
    );
    if (!activeAssignment) {
      return Response.json(
        buildEphemeralMessage(
          `<@&${invocation.roleId}> is not currently active for <@${invocation.userId}>.`
        )
      );
    }

    try {
      await removeGuildMemberRole(
        interaction.guild_id,
        invocation.userId,
        invocation.roleId,
        discordBotToken
      );
    } catch (error) {
      console.error("Timed role removal failed", error);
      return Response.json(buildEphemeralMessage("Failed to remove the timed role."));
    }

    await store.deleteTimedRole({
      guildId: interaction.guild_id,
      userId: invocation.userId,
      roleId: invocation.roleId,
    });
    return Response.json(
      buildEphemeralMessage(`Removed <@&${invocation.roleId}> from <@${invocation.userId}>.`)
    );
  }

  if (invocation.commandName === "blocklist" && invocation.subcommandName === "add") {
    const normalizedEmoji = normalizeEmoji(invocation.emoji);
    if (!normalizedEmoji) {
      return Response.json(buildEphemeralMessage("Invalid emoji."));
    }
    let isAlreadyBlocked = false;
    try {
      const config = await store.readConfig();
      isAlreadyBlocked =
        config.guilds?.[interaction.guild_id]?.emojis.includes(normalizedEmoji) ?? false;
    } catch (error) {
      console.error("Failed to load moderation config", error);
      return Response.json(buildEphemeralMessage("Failed to update the server blocklist."));
    }
    if (isAlreadyBlocked) {
      return Response.json(
        buildEphemeralMessage(`${invocation.emoji} is already blocked in this server.`)
      );
    }
    await store.applyGuildEmojiMutation({
      guildId: interaction.guild_id,
      emoji: normalizedEmoji,
      action: "add",
    });
    return Response.json(
      buildEphemeralMessage(`Blocked ${invocation.emoji} in this server.`)
    );
  }

  if (invocation.commandName === "blocklist" && invocation.subcommandName === "remove") {
    const normalizedEmoji = normalizeEmoji(invocation.emoji);
    if (!normalizedEmoji) {
      return Response.json(buildEphemeralMessage("Invalid emoji."));
    }
    let isBlocked = false;
    try {
      const config = await store.readConfig();
      isBlocked =
        config.guilds?.[interaction.guild_id]?.emojis.includes(normalizedEmoji) ?? false;
    } catch (error) {
      console.error("Failed to load moderation config", error);
      return Response.json(buildEphemeralMessage("Failed to update the server blocklist."));
    }
    if (!isBlocked) {
      return Response.json(
        buildEphemeralMessage(
          `${invocation.emoji} is not currently blocked in this server.`
        )
      );
    }
    await store.applyGuildEmojiMutation({
      guildId: interaction.guild_id,
      emoji: normalizedEmoji,
      action: "remove",
    });
    return Response.json(
      buildEphemeralMessage(`Unblocked ${invocation.emoji} in this server.`)
    );
  }

  return Response.json(buildEphemeralMessage("Unsupported command."));
}

function formatBoundedBulletList(
  title: string,
  emptyMessage: string,
  items: string[]
): string {
  if (items.length === 0) {
    return emptyMessage;
  }

  const lines = [title];

  for (let index = 0; index < items.length; index += 1) {
    const line = `- ${items[index]}`;
    const remainingAfterLine = items.length - index - 1;

    if (remainingAfterLine === 0) {
      return [...lines, line].join("\n");
    }

    const contentWithLine = [...lines, line].join("\n");
    const summaryLine = `...and ${remainingAfterLine} more.`;

    if (`${contentWithLine}\n${summaryLine}`.length <= DISCORD_MESSAGE_CONTENT_LIMIT) {
      lines.push(line);
      continue;
    }

    let omittedCount = items.length - index;
    while (lines.length > 1) {
      const truncatedContent = [...lines, `...and ${omittedCount} more.`].join("\n");
      if (truncatedContent.length <= DISCORD_MESSAGE_CONTENT_LIMIT) {
        return truncatedContent;
      }

      lines.pop();
      omittedCount += 1;
    }

    return `${title}\n...and ${items.length} more.`;
  }

  return lines.join("\n");
}