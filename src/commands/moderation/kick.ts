import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../core/command';
import { canActOn } from '../../permissions/guards';
import { recordModeration } from '../../services/moderationLog';
import { OperationalError } from '../../utils/errors';

export const kickCommand: Command = {
  access: 'moderator',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Remove a member from the server. They can rejoin with a new invite.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('The member to remove').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Recorded in #moderation').setRequired(true),
    ),

  async execute({ interaction, guild, member }: CommandContext): Promise<void> {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    const target = await guild.members.fetch(user.id).catch(() => null);
    if (!target) throw new OperationalError('That member is not in this server.');

    const permitted = canActOn(member, target);
    if (!permitted.ok) throw new OperationalError(permitted.reason);

    // Best effort: a member with DMs closed must not block the kick.
    await target
      .send(`You have been removed from **${guild.name}**.\n\nReason: ${reason}`)
      .catch(() => undefined);

    await target.kick(`${reason} — by ${member.user.tag}`);

    await recordModeration(guild, {
      action: 'KICK',
      moderator: member.user,
      target: user,
      reason,
    });

    await interaction.editReply(`Removed **${user.tag}**.`);
  },
};
