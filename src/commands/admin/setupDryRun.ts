import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../core/command';
import { logger } from '../../services/logger';
import { finaliseSetup } from '../../services/provisioning/finalise';
import { syncServer } from '../../services/provisioning/provisioner';
import { renderReport } from '../../services/provisioning/report';

/**
 * /setup-dry-run — exactly what /setup would do, with every write suppressed.
 *
 * This runs the same provisioner and the same finalisation as /setup with
 * `dryRun: true`; there is no separate "simulation" code path that could drift
 * out of sync with reality.
 */
export const setupDryRunCommand: Command = {
  access: 'admin',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('setup-dry-run')
    .setDescription('Show what /setup would create or change. Writes nothing.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute({ interaction, guild, member }: CommandContext): Promise<void> {
    logger.info('SETUP', `Dry run requested by ${member.user.tag}`);

    const report = await syncServer(guild, { dryRun: true, actorTag: member.user.tag });
    await finaliseSetup(guild, report, true);

    await interaction.editReply({ embeds: renderReport(report) });
  },
};
