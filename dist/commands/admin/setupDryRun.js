"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDryRunCommand = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../services/logger");
const finalise_1 = require("../../services/provisioning/finalise");
const provisioner_1 = require("../../services/provisioning/provisioner");
const report_1 = require("../../services/provisioning/report");
/**
 * /setup-dry-run — exactly what /setup would do, with every write suppressed.
 *
 * This runs the same provisioner and the same finalisation as /setup with
 * `dryRun: true`; there is no separate "simulation" code path that could drift
 * out of sync with reality.
 */
exports.setupDryRunCommand = {
    access: 'admin',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('setup-dry-run')
        .setDescription('Show what /setup would create or change. Writes nothing.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    async execute({ interaction, guild, member }) {
        logger_1.logger.info('SETUP', `Dry run requested by ${member.user.tag}`);
        const report = await (0, provisioner_1.syncServer)(guild, { dryRun: true, actorTag: member.user.tag });
        await (0, finalise_1.finaliseSetup)(guild, report, true);
        await interaction.editReply({ embeds: (0, report_1.renderReport)(report) });
    },
};
//# sourceMappingURL=setupDryRun.js.map