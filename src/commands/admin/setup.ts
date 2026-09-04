import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../core/command';
import { logger } from '../../services/logger';
import { finaliseSetup } from '../../services/provisioning/finalise';
import { syncServer } from '../../services/provisioning/provisioner';
import { renderReport } from '../../services/provisioning/report';
import { countAll } from '../../services/provisioning/types';
import { state } from '../../services/state';

/**
 * /setup — bring the server in line with the blueprint.
 *
 * Safe to run as often as you like: it creates what is missing, corrects what
 * has drifted, and never deletes anything. Structure first, then content and
 * AutoMod, so a content failure cannot leave the channels half-built.
 */
export const setupCommand: Command = {
  access: 'admin',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create or synchronise THE DESK server structure. Safe to run repeatedly.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addBooleanOption((option) =>
      option
        .setName('publish-content')
        .setDescription('Also publish welcome, rules, channel guides, FAQ and AutoMod (default: true)'),
    ),

  async execute({ interaction, guild, member }: CommandContext): Promise<void> {
    const publishContent = interaction.options.getBoolean('publish-content') ?? true;

    logger.info('SETUP', `Setup started by ${member.user.tag}`);

    const report = await syncServer(guild, { dryRun: false, actorTag: member.user.tag });
    if (publishContent) await finaliseSetup(guild, report, false);

    state.recordSetup(guild.id, member.id);

    const totals = countAll(report);
    logger.info(
      'SETUP',
      `Setup completed — ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged, ${totals.failed} failed`,
    );

    await interaction.editReply({ embeds: renderReport(report) });
  },
};
