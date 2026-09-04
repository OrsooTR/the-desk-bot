import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../core/command';
import { canActOn } from '../../permissions/guards';
import { recordModeration } from '../../services/moderationLog';
import { OperationalError } from '../../utils/errors';
import { plural } from '../../utils/format';

/** Discord's maximum timeout length. */
const MAX_MINUTES = 28 * 24 * 60;

export const timeoutCommand: Command = {
  access: 'moderator',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily mute a member, or clear an existing timeout.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('user').setDescription('The member to time out').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('minutes')
        .setDescription(`Length in minutes (0 clears the timeout, max ${MAX_MINUTES})`)
        .setMinValue(0)
        .setMaxValue(MAX_MINUTES)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Recorded in #moderation').setRequired(true),
    ),

  async execute({ interaction, guild, member }: CommandContext): Promise<void> {
    const user = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason', true);

    const target = await guild.members.fetch(user.id).catch(() => null);
    if (!target) throw new OperationalError('That member is not in this server.');

    const permitted = canActOn(member, target);
    if (!permitted.ok) throw new OperationalError(permitted.reason);

    if (minutes === 0) {
      await target.timeout(null, `Timeout cleared — by ${member.user.tag}`);
      await recordModeration(guild, {
        action: 'TIMEOUT',
        moderator: member.user,
        target: user,
        reason,
        detail: 'cleared',
      });
      await interaction.editReply(`Cleared the timeout on **${user.tag}**.`);
      return;
    }

    await target.timeout(minutes * 60_000, `${reason} — by ${member.user.tag}`);

    await target
      .send(
        `You have been timed out in **${guild.name}** for ${plural(minutes, 'minute')}.\n\nReason: ${reason}`,
      )
      .catch(() => undefined);

    await recordModeration(guild, {
      action: 'TIMEOUT',
      moderator: member.user,
      target: user,
      reason,
      detail: plural(minutes, 'minute'),
    });

    await interaction.editReply(`**${user.tag}** timed out for ${plural(minutes, 'minute')}.`);
  },
};
