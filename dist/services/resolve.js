"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISCORD_TYPE = void 0;
exports.findRole = findRole;
exports.findCategory = findCategory;
exports.findChannelAnyType = findChannelAnyType;
exports.findChannel = findChannel;
exports.findTextChannel = findTextChannel;
exports.findVoiceChannel = findVoiceChannel;
exports.findSessionChannel = findSessionChannel;
exports.findLogChannel = findLogChannel;
const discord_js_1 = require("discord.js");
const server_1 = require("../config/server");
const state_1 = require("./state");
/* ────────────────────────────────────────────────────────────
 * Resource resolution
 *
 * Every lookup follows the same two-step rule:
 *   1. the snowflake we remembered in state.json  (survives renames)
 *   2. an exact, case-insensitive name match      (survives a lost state file)
 *
 * When step 2 succeeds we re-write state, so the server heals itself instead
 * of drifting. When both fail, the resource is genuinely missing and /setup
 * will create it.
 * ──────────────────────────────────────────────────────────── */
/** Accepts core role keys and self-assignable ones alike. */
function findRole(guild, key) {
    const definition = (0, server_1.roleDef)(key);
    if (!definition)
        return null;
    const remembered = state_1.state.roleId(key);
    if (remembered) {
        const byId = guild.roles.cache.get(remembered);
        if (byId)
            return byId;
    }
    const name = definition.name.toLowerCase();
    const byName = guild.roles.cache.find((role) => role.name.toLowerCase() === name) ?? null;
    if (byName && byName.id !== remembered)
        state_1.state.rememberRole(key, byName.id);
    return byName;
}
function findCategory(guild, key) {
    const definition = server_1.SERVER.categories.find((category) => category.key === key);
    if (!definition)
        return null;
    const remembered = state_1.state.categoryId(key);
    if (remembered) {
        const byId = guild.channels.cache.get(remembered);
        if (byId?.type === discord_js_1.ChannelType.GuildCategory)
            return byId;
    }
    const name = definition.name.toLowerCase();
    const byName = guild.channels.cache.find((channel) => channel.type === discord_js_1.ChannelType.GuildCategory && channel.name.toLowerCase() === name) ?? null;
    if (byName && byName.id !== remembered)
        state_1.state.rememberCategory(key, byName.id);
    return byName;
}
exports.DISCORD_TYPE = {
    text: discord_js_1.ChannelType.GuildText,
    announcement: discord_js_1.ChannelType.GuildAnnouncement,
    forum: discord_js_1.ChannelType.GuildForum,
    media: discord_js_1.ChannelType.GuildMedia,
    voice: discord_js_1.ChannelType.GuildVoice,
    stage: discord_js_1.ChannelType.GuildStageVoice,
};
const MANAGED_TYPES = new Set(Object.values(exports.DISCORD_TYPE));
function isManaged(channel, wanted) {
    return !!channel && channel.type === wanted && MANAGED_TYPES.has(channel.type);
}
/**
 * Find a channel by key regardless of its current type.
 *
 * Used when the blueprint's type no longer matches what is live — the type
 * migration needs to see the channel that is actually there in order to
 * report it, rather than concluding it is missing and creating a duplicate.
 */
function findChannelAnyType(guild, key) {
    const entry = (0, server_1.allChannels)().find((candidate) => candidate.channel.key === key);
    if (!entry)
        return null;
    const remembered = state_1.state.channelId(key);
    if (remembered) {
        const byId = guild.channels.cache.get(remembered);
        if (byId)
            return byId;
    }
    const name = entry.channel.name.toLowerCase();
    return guild.channels.cache.find((channel) => channel.name.toLowerCase() === name) ?? null;
}
function findChannel(guild, key) {
    const entry = (0, server_1.allChannels)().find((candidate) => candidate.channel.key === key);
    if (!entry)
        return null;
    const wantedType = exports.DISCORD_TYPE[entry.channel.type];
    const remembered = state_1.state.channelId(key);
    if (remembered) {
        const byId = guild.channels.cache.get(remembered);
        if (isManaged(byId, wantedType))
            return byId;
    }
    // Scope the name match to the owning category where we know it, so a
    // manually created `#general` elsewhere is never mistaken for ours.
    const parent = findCategory(guild, entry.category.key);
    const name = entry.channel.name.toLowerCase();
    const candidates = [...guild.channels.cache.values()].filter((channel) => isManaged(channel, wantedType) && channel.name.toLowerCase() === name);
    const byName = candidates.find((channel) => parent && channel.parentId === parent.id) ??
        candidates[0] ??
        null;
    if (byName && byName.id !== remembered)
        state_1.state.rememberChannel(key, byName.id);
    return byName;
}
function findTextChannel(guild, key) {
    const channel = findChannel(guild, key);
    if (channel?.type === discord_js_1.ChannelType.GuildText)
        return channel;
    if (channel?.type === discord_js_1.ChannelType.GuildAnnouncement)
        return channel;
    return null;
}
function findVoiceChannel(guild, key) {
    const channel = findChannel(guild, key);
    return channel?.type === discord_js_1.ChannelType.GuildVoice ? channel : null;
}
/** Voice or stage — the two places a scheduled session can actually happen. */
function findSessionChannel(guild, key) {
    const channel = findChannel(guild, key);
    if (channel?.type === discord_js_1.ChannelType.GuildVoice)
        return channel;
    if (channel?.type === discord_js_1.ChannelType.GuildStageVoice)
        return channel;
    return null;
}
/** The channel bot output is mirrored into, or null if setup has not run yet. */
function findLogChannel(guild) {
    return findTextChannel(guild, server_1.SERVER.logChannelKey);
}
//# sourceMappingURL=resolve.js.map