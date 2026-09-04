"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberMeets = memberMeets;
exports.assertAccess = assertAccess;
exports.canActOn = canActOn;
const discord_js_1 = require("discord.js");
const server_1 = require("../config/server");
const resolve_1 = require("../services/resolve");
const errors_1 = require("../utils/errors");
const RANK = new Map(server_1.ROLE_HIERARCHY.map((key, index) => [key, index]));
function rankOf(key) {
    return RANK.get(key) ?? Number.MAX_SAFE_INTEGER;
}
/**
 * True when the member holds the required role or anything above it.
 *
 * Two intentional bypasses:
 *  - the guild owner always passes, so a misconfigured role list can never
 *    lock the owner out of /setup;
 *  - anyone holding Administrator passes, because Discord already grants them
 *    everything these commands do.
 */
function memberMeets(member, level) {
    if (level === 'everyone')
        return true;
    if (member.id === member.guild.ownerId)
        return true;
    if (member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator))
        return true;
    const required = rankOf(level);
    // `bot` sits at the bottom of the hierarchy and grants nothing; it must never
    // satisfy a requirement by being numerically "above" something.
    return server_1.ROLE_HIERARCHY.some((key) => {
        if (key === 'bot')
            return false;
        if (rankOf(key) > required)
            return false;
        const role = (0, resolve_1.findRole)(member.guild, key);
        return role ? member.roles.cache.has(role.id) : false;
    });
}
/** Throws a user-safe error when the member does not meet `level`. */
function assertAccess(member, level, commandName) {
    if (memberMeets(member, level))
        return;
    throw new errors_1.ForbiddenError(`\`/${commandName}\` requires **${labelFor(level)}** or above.`);
}
function labelFor(level) {
    if (level === 'everyone')
        return 'Member';
    const definition = server_1.ROLE_HIERARCHY.includes(level) ? level : 'member';
    return definition
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (character) => character.toUpperCase())
        .trim();
}
/**
 * Discord's own hierarchy check: you cannot moderate someone whose highest
 * role is at or above yours. Enforced before every kick/ban/timeout so the
 * bot returns a clear refusal instead of a raw API error.
 */
function canActOn(actor, target) {
    if (actor.id === target.id)
        return { ok: false, reason: 'You cannot moderate yourself.' };
    if (target.id === target.guild.ownerId)
        return { ok: false, reason: 'The server owner cannot be moderated.' };
    if (actor.id !== actor.guild.ownerId && actor.roles.highest.position <= target.roles.highest.position)
        return { ok: false, reason: 'That member has a role equal to or above yours.' };
    const me = target.guild.members.me;
    if (!me)
        return { ok: false, reason: 'I could not resolve my own membership in this server.' };
    if (me.roles.highest.position <= target.roles.highest.position)
        return {
            ok: false,
            reason: 'That member is above me in the role list, so I cannot act on them.',
        };
    return { ok: true };
}
//# sourceMappingURL=guards.js.map