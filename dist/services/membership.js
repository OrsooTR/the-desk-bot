"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignJoinRole = assignJoinRole;
exports.handleVerification = handleVerification;
const discord_js_1 = require("discord.js");
const content_1 = require("../config/content");
const server_1 = require("../config/server");
const errors_1 = require("../utils/errors");
const logger_1 = require("./logger");
const resolve_1 = require("./resolve");
/* ────────────────────────────────────────────────────────────
 * Membership lifecycle
 *
 * join  → @New Member  (welcome, rules, general)
 * accept the rules → @Member  (full community access)
 *
 * Kept deliberately small. When this grows into a real onboarding flow —
 * screening, role selection, an application form — it slots in here without
 * touching the provisioner or the command layer.
 * ──────────────────────────────────────────────────────────── */
/** Assigns the join role. Silent no-op if the member already holds it. */
async function assignJoinRole(member) {
    if (member.user.bot)
        return;
    const role = (0, resolve_1.findRole)(member.guild, server_1.SERVER.joinRole);
    if (!role) {
        logger_1.logger.warn('MEMBER', `Cannot assign the join role: @${server_1.SERVER.joinRole} does not exist. Run /setup.`);
        return;
    }
    if (member.roles.cache.has(role.id))
        return;
    try {
        await member.roles.add(role, 'Joined the server');
        logger_1.logger.info('MEMBER', `${member.user.tag} joined — assigned @${role.name}`);
    }
    catch (error) {
        logger_1.logger.error('MEMBER', `Could not assign @${role.name} to ${member.user.tag}`, error);
    }
}
/**
 * Promotes New Member → Member when the rules are accepted.
 *
 * Ordering matters: the verified role is added before the join role is removed,
 * so a failure halfway through leaves the member with more access rather than
 * none at all.
 */
async function handleVerification(interaction) {
    const member = interaction.member;
    if (!interaction.inCachedGuild() || !member || !('roles' in member)) {
        await interaction.reply({
            content: 'Verification only works inside the server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const guildMember = await interaction.guild.members.fetch(interaction.user.id);
    const verified = (0, resolve_1.findRole)(interaction.guild, server_1.SERVER.verifiedRole);
    const pending = (0, resolve_1.findRole)(interaction.guild, server_1.SERVER.joinRole);
    if (!verified) {
        logger_1.logger.warn('MEMBER', `Verification failed: @${server_1.SERVER.verifiedRole} does not exist. Run /setup.`);
        await interaction.reply({
            content: 'Verification is not configured yet. A staff member has been notified.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (guildMember.roles.cache.has(verified.id)) {
        await interaction.reply({
            content: content_1.VERIFICATION.alreadyVerified,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        await guildMember.roles.add(verified, 'Accepted the community rules');
        if (pending && guildMember.roles.cache.has(pending.id)) {
            await guildMember.roles.remove(pending, 'Accepted the community rules');
        }
        logger_1.logger.info('MEMBER', `${guildMember.user.tag} accepted the rules — promoted to @${verified.name}`);
        await interaction.reply({ content: content_1.VERIFICATION.success, flags: discord_js_1.MessageFlags.Ephemeral });
    }
    catch (error) {
        logger_1.logger.error('MEMBER', `Verification failed for ${guildMember.user.tag}`, error);
        const { message } = (0, errors_1.toUserMessage)(error);
        await interaction.reply({
            content: `${message} Ask a moderator to verify you manually.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
//# sourceMappingURL=membership.js.map