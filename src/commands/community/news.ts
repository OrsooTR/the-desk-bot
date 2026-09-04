import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../core/command';
import { postDigest } from '../../services/news';

/**
 * /news — post the digest now.
 *
 * The scheduler handles the daily run; this exists for testing a feed change
 * and for the morning the bot was restarting at 06:30.
 */
export const newsCommand: Command = {
  access: 'mentor',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Post the market digest now. Mentor+.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute({ interaction, guild }: CommandContext): Promise<void> {
    const url = await postDigest(guild);
    await interaction.editReply(
      url ? `Digest posted: ${url}` : 'The news channel is missing. Run `/setup`.',
    );
  },
};
