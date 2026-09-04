"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onVoiceStateUpdate = onVoiceStateUpdate;
exports.sweepOrphanedRooms = sweepOrphanedRooms;
const discord_js_1 = require("discord.js");
const server_1 = require("../config/server");
const format_1 = require("../utils/format");
const logger_1 = require("./logger");
const resolve_1 = require("./resolve");
const state_1 = require("./state");
/** Resolve the configured hubs against the live server. */
function hubs(guild) {
    const found = [];
    for (const { channel: definition } of (0, server_1.allChannels)()) {
        if (!definition.spawner)
            continue;
        const live = (0, resolve_1.findChannel)(guild, definition.key);
        if (!live || live.type !== discord_js_1.ChannelType.GuildVoice)
            continue;
        found.push({
            channelId: live.id,
            spawner: definition.spawner,
            categoryId: live.parentId,
        });
    }
    return found;
}
async function onVoiceStateUpdate(before, after) {
    // Someone left a room: it may now be empty and disposable.
    if (before.channelId && before.channelId !== after.channelId) {
        await cleanUp(before.guild, before.channelId);
    }
    // Someone joined a hub: give them a room of their own.
    if (after.channelId && after.channelId !== before.channelId && after.member) {
        const hub = hubs(after.guild).find((entry) => entry.channelId === after.channelId);
        if (hub)
            await spawn(after.guild, after.member, hub);
    }
}
async function spawn(guild, member, hub) {
    // Belt and braces: the hub's own overwrites already stop unauthorised
    // members from connecting, but a permission mistake should not become a
    // privilege escalation.
    if (hub.spawner.restrictTo && !hasAnyRole(member, hub.spawner.restrictTo)) {
        await member.voice.disconnect('Not permitted to create a room here').catch(() => undefined);
        return;
    }
    const me = guild.members.me;
    if (!me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
        logger_1.logger.warn('PERMISSIONS', 'Cannot create a voice room: I need Manage Channels.');
        return;
    }
    const name = (0, format_1.truncate)(hub.spawner.namePattern.replace('{user}', member.displayName), 100);
    try {
        const room = await guild.channels.create({
            name,
            type: discord_js_1.ChannelType.GuildVoice,
            ...(hub.categoryId ? { parent: hub.categoryId } : {}),
            ...(hub.spawner.userLimit ? { userLimit: hub.spawner.userLimit } : {}),
            ...(hub.spawner.private ? { permissionOverwrites: privateOverwrites(guild, member, hub) } : {}),
            reason: `On-demand voice room for ${member.user.tag}`,
        });
        state_1.state.update((current) => {
            current.tempVoiceChannels[room.id] = {
                ownerId: member.id,
                createdAt: new Date().toISOString(),
            };
        });
        await member.voice.setChannel(room).catch(async () => {
            // They left before the room existed. Do not leave an orphan behind.
            await room.delete('Creator left before the room was ready').catch(() => undefined);
            state_1.state.update((current) => {
                delete current.tempVoiceChannels[room.id];
            });
        });
        logger_1.logger.info('EVENT', `Voice room "${name}" opened by ${member.user.tag}`);
    }
    catch (error) {
        logger_1.logger.error('EVENT', `Could not create a voice room for ${member.user.tag}`, error);
    }
}
/** A private room: invisible to everyone except the permitted roles. */
function privateOverwrites(guild, member, hub) {
    const allowed = (hub.spawner.restrictTo ?? [])
        .map((key) => (0, resolve_1.findRole)(guild, key)?.id)
        .filter((id) => id !== undefined);
    return [
        { id: guild.roles.everyone.id, deny: [discord_js_1.PermissionFlagsBits.ViewChannel] },
        {
            id: member.id,
            allow: [
                discord_js_1.PermissionFlagsBits.ViewChannel,
                discord_js_1.PermissionFlagsBits.Connect,
                discord_js_1.PermissionFlagsBits.Speak,
            ],
        },
        ...allowed.map((id) => ({
            id,
            allow: [
                discord_js_1.PermissionFlagsBits.ViewChannel,
                discord_js_1.PermissionFlagsBits.Connect,
                discord_js_1.PermissionFlagsBits.Speak,
                discord_js_1.PermissionFlagsBits.MoveMembers,
            ],
        })),
    ];
}
/**
 * Delete a temporary room once it empties.
 *
 * Every condition has to hold: we created it, we still have it recorded, it is
 * a voice channel, and nobody is in it. A no on any of them means we leave it
 * alone, because the cost of a false positive here is somebody's channel.
 */
async function cleanUp(guild, channelId) {
    if (!state_1.state.read().tempVoiceChannels[channelId])
        return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== discord_js_1.ChannelType.GuildVoice) {
        state_1.state.update((current) => {
            delete current.tempVoiceChannels[channelId];
        });
        return;
    }
    if (channel.members.size > 0)
        return;
    try {
        await channel.delete('On-demand voice room emptied');
        logger_1.logger.info('EVENT', `Voice room "${channel.name}" closed (empty)`);
    }
    catch (error) {
        logger_1.logger.error('EVENT', `Could not delete the empty voice room ${channel.name}`, error);
    }
    finally {
        state_1.state.update((current) => {
            delete current.tempVoiceChannels[channelId];
        });
    }
}
/**
 * Sweep on startup: rooms that emptied while the bot was down would otherwise
 * linger forever, since the voice event that would have cleaned them up has
 * already been and gone.
 */
async function sweepOrphanedRooms(guild) {
    const tracked = Object.keys(state_1.state.read().tempVoiceChannels);
    let removed = 0;
    for (const channelId of tracked) {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            state_1.state.update((current) => {
                delete current.tempVoiceChannels[channelId];
            });
            continue;
        }
        if (channel.type !== discord_js_1.ChannelType.GuildVoice)
            continue;
        if (channel.members.size > 0)
            continue;
        await channel.delete('Orphaned on-demand voice room').catch(() => undefined);
        state_1.state.update((current) => {
            delete current.tempVoiceChannels[channelId];
        });
        removed += 1;
    }
    if (removed > 0)
        logger_1.logger.info('BOOT', `Swept ${removed} orphaned voice room(s)`);
    return removed;
}
function hasAnyRole(member, keys) {
    if (member.id === member.guild.ownerId)
        return true;
    return keys.some((key) => {
        const role = (0, resolve_1.findRole)(member.guild, key);
        return role ? member.roles.cache.has(role.id) : false;
    });
}
//# sourceMappingURL=voiceRooms.js.map