"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCommand = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../services/logger");
const finalise_1 = require("../../services/provisioning/finalise");
const provisioner_1 = require("../../services/provisioning/provisioner");
const report_1 = require("../../services/provisioning/report");
const types_1 = require("../../services/provisioning/types");
const state_1 = require("../../services/state");
/**
 * /setup — bring the server in line with the blueprint.
 *
 * Safe to run as often as you like: it creates what is missing, corrects what
 * has drifted, and never deletes anything. Structure first, then content and
 * AutoMod, so a content failure cannot leave the channels half-built.
 */
exports.setupCommand = {
    access: 'admin',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('setup')
        .setDescription('Create or synchronise THE DESK server structure. Safe to run repeatedly.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addBooleanOption((option) => option
        .setName('publish-content')
        .setDescription('Also publish welcome, rules, channel guides, FAQ and AutoMod (default: true)')),
    async execute({ interaction, guild, member }) {
        const publishContent = interaction.options.getBoolean('publish-content') ?? true;
        logger_1.logger.info('SETUP', `Setup started by ${member.user.tag}`);
        const report = await (0, provisioner_1.syncServer)(guild, { dryRun: false, actorTag: member.user.tag });
        if (publishContent)
            await (0, finalise_1.finaliseSetup)(guild, report, false);
        state_1.state.recordSetup(guild.id, member.id);
        const totals = (0, types_1.countAll)(report);
        logger_1.logger.info('SETUP', `Setup completed — ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged, ${totals.failed} failed`);
        await interaction.editReply({ embeds: (0, report_1.renderReport)(report) });
    },
};
//# sourceMappingURL=setup.js.map