import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../core/command';
import { recordModeration } from '../../services/moderationLog';
import { OperationalError } from '../../utils/errors';
import { plural } from '../../utils/format';

/**
 * /clear — bulk delete recent messages.
 *
 * Admin-only by design: it is the only command here that destroys member
 * content, and Discord's bulk endpoint cannot undo it.
 */
export const clearCommand: Command = {
  access: 'admin',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete recent messages in this channel. Admin only.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('How many messages to scan and delete (1–100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .addUserOption((option) =>
      option.setName('user').setDescription('Only delete messages from this member'),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Recorded in #moderation'),
    ),

  async execute({ interaction, guild, member }: CommandContext): Promise<void> {
    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') ?? undefined;

    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new OperationalError('This command only works in a normal text channel.');
    }

    const fetched = await channel.messages.fetch({ limit: amount });

    // Discord refuses to bulk delete anything older than 14 days. Filtering
    // first turns a hard API error into an accurate count.
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const deletable = fetched.filter(
      (message) =>
        message.createdTimestamp > cutoff && (!user || message.author.id === user.id) && !message.pinned,
    );

    if (deletable.size === 0) {
      await interaction.editReply(
        'Nothing to delete. Messages older than 14 days and pinned messages are skipped.',
      );
      return;
    }

    const deleted = await channel.bulkDelete(deletable, true);
    const detail = `${plural(deleted.size, 'message')} in #${channel.name}${user ? ` from ${user.tag}` : ''}`;

    await recordModeration(guild, {
      action: 'CLEAR',
      moderator: member.user,
      ...(user ? { target: user } : {}),
      ...(reason ? { reason } : {}),
      detail,
    });

    await interaction.editReply(
      `Deleted ${detail}.${deleted.size < deletable.size ? ' Some were too old to remove.' : ''}`,
    );
  },
};
