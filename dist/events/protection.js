"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProtectionHandlers = registerProtectionHandlers;
const discord_js_1 = require("discord.js");
const env_1 = require("../config/env");
const protection_1 = require("../config/protection");
const logger_1 = require("../services/logger");
const protection_2 = require("../services/protection");
/**
 * Gateway listeners for the anti-nuke watcher.
 *
 * Kept separate from the feature handlers so the whole subsystem can be
 * switched off in one place, and so it is obvious at a glance which events
 * exist purely for defence.
 */
function registerProtectionHandlers(client) {
    if (!protection_1.PROTECTION.enabled) {
        logger_1.logger.warn('BOOT', 'Anti-nuke is disabled in config/protection.ts', { discord: false });
        return;
    }
    // ChannelDelete also fires for DM channels, which have no guild.
    client.on(discord_js_1.Events.ChannelDelete, (channel) => {
        if ('guild' in channel)
            report(channel.guild, 'channelDelete');
    });
    client.on(discord_js_1.Events.ChannelCreate, (channel) => report(channel.guild, 'channelCreate'));
    client.on(discord_js_1.Events.GuildRoleDelete, (role) => report(role.guild, 'roleDelete'));
    client.on(discord_js_1.Events.GuildRoleCreate, (role) => report(role.guild, 'roleCreate'));
    client.on(discord_js_1.Events.GuildRoleUpdate, (_old, role) => report(role.guild, 'roleUpdate'));
    client.on(discord_js_1.Events.GuildBanAdd, (ban) => report(ban.guild, 'ban'));
    client.on(discord_js_1.Events.WebhooksUpdate, (channel) => report(channel.guild, 'webhookCreate'));
    // A kick is a member removal, but so is leaving voluntarily. The audit log
    // lookup inside noteAction only matches an actual MemberKick entry from the
    // last few seconds, so a wave of people simply leaving cannot trip this.
    client.on(discord_js_1.Events.GuildMemberRemove, (member) => report(member.guild, 'kick'));
    logger_1.logger.info('BOOT', `Anti-nuke armed (response: ${protection_1.PROTECTION.response})`, { discord: false });
}
function report(guild, action) {
    if (guild.id !== (0, env_1.env)().guildId)
        return;
    // Never let a defence handler throw into the gateway loop.
    void (0, protection_2.noteAction)(guild, action).catch((error) => {
        logger_1.logger.error('ERROR', `Anti-nuke handler for "${action}" threw`, error);
    });
}
//# sourceMappingURL=protection.js.map