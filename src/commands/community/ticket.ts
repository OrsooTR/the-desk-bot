import { SlashCommandBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../core/command';
import { closeTicket } from '../../services/tickets';
import { OperationalError } from '../../utils/errors';

/**
 * /ticket close — the command form of the Close button.
 *
 * Opening happens through the panel button in the support channel, not here:
 * a button in the right place is easier to find than a command you have to
 * know exists.
 */
export const ticketCommand: Command = {
  access: 'everyone',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage a support ticket.')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Close the ticket you are currently in')
        .addStringOption((option) =>
          option.setName('reason').setDescription('Optional note for the record'),
        ),
    ),

  async execute({ interaction, guild, member }: CommandContext): Promise<void> {
    const thread = interaction.channel;
    if (!thread?.isThread()) {
      throw new OperationalError(
        'Run this inside the ticket you want to close.',
        'Tickets are opened with the button in the support channel.',
      );
    }

    const reason = interaction.options.getString('reason') ?? undefined;
    await closeTicket(guild, thread, member, reason);
    await interaction.editReply('Ticket closed and archived.');
  },
};
