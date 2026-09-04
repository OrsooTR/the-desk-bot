"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HIDDEN_FROM_EVERYONE = exports.role = exports.self = exports.everyone = exports.ADMIN_GUILD_PERMISSIONS = exports.MODERATOR_GUILD_PERMISSIONS = exports.MEMBER_GUILD_PERMISSIONS = exports.STAGE_HOST = exports.STAGE_AUDIENCE = exports.VOICE_HOST = exports.VOICE = exports.CURATE = exports.DISCUSS_UNVERIFIED = exports.DISCUSS = exports.THREAD_CREATE = exports.THREAD_REPLY = exports.POST = exports.REACT = exports.READ = void 0;
exports.merge = merge;
exports.allowRoles = allowRoles;
exports.denyRoles = denyRoles;
/* ────────────────────────────────────────────────────────────
 * Permission bundles
 *
 * Discord roles do NOT inherit from each other, so every bundle is expressed
 * as a complete set and composed with `merge()`. Keeping them here means a
 * permission change is a one-line edit, not a sweep through the blueprint.
 * ──────────────────────────────────────────────────────────── */
/** See a channel and its history. The minimum useful grant. */
exports.READ = ['ViewChannel', 'ReadMessageHistory'];
/** Reactions and expression. Harmless without ViewChannel. */
exports.REACT = ['AddReactions', 'UseExternalEmojis', 'UseExternalStickers'];
/** Post a top-level message with attachments/links. */
exports.POST = [
    'SendMessages',
    'EmbedLinks',
    'AttachFiles',
    'UseApplicationCommands',
];
/** Reply inside an existing thread. */
exports.THREAD_REPLY = ['SendMessagesInThreads'];
/** Open a new public thread. */
exports.THREAD_CREATE = ['CreatePublicThreads', 'SendMessagesInThreads'];
/** A plain, fully-participating community member in a discussion channel. */
exports.DISCUSS = merge(exports.READ, exports.REACT, exports.POST, exports.THREAD_CREATE);
/**
 * A restricted first-post grant for unverified accounts: they can talk, but
 * cannot post links or files. Removes the highest-value spam vector while
 * still letting a newcomer say hello.
 */
exports.DISCUSS_UNVERIFIED = merge(exports.READ, ['AddReactions'], [
    'SendMessages',
    'UseApplicationCommands',
]);
/** Curate a channel: pin, delete, tidy threads. Granted per-channel, not globally. */
exports.CURATE = ['ManageMessages', 'ManageThreads'];
/** Join and participate in a voice room. */
exports.VOICE = merge(exports.READ, exports.REACT, [
    'Connect',
    'Speak',
    'Stream',
    'UseVAD',
    'SendMessages',
    'UseApplicationCommands',
]);
/** Run a live session: mute, move, and cut through the noise. */
exports.VOICE_HOST = [
    'MuteMembers',
    'DeafenMembers',
    'MoveMembers',
    'PrioritySpeaker',
];
/**
 * Stage audience: present and able to ask, but not on the microphone by
 * default. Speaking is granted by the host, which is the entire point of a
 * stage over a voice room.
 */
exports.STAGE_AUDIENCE = merge(exports.READ, exports.REACT, [
    'Connect',
    'RequestToSpeak',
    'UseApplicationCommands',
]);
/**
 * Stage host, i.e. Discord's "Stage Moderator": it is defined as holding
 * ManageChannels + MuteMembers + MoveMembers *on the stage channel*. Granted
 * as a channel overwrite, ManageChannels applies to that one channel and
 * nothing else — it does not let a Mentor touch the rest of the server.
 */
exports.STAGE_HOST = merge(exports.STAGE_AUDIENCE, [
    'Speak',
    'MuteMembers',
    'MoveMembers',
    'ManageChannels',
]);
/* ────────────────────────────────────────────────────────────
 * Guild-wide role permission sets
 * ──────────────────────────────────────────────────────────── */
/**
 * Baseline for a verified member. Note the deliberate omissions:
 * no MentionEveryone, no ManageMessages, no ManageChannels, no ManageRoles.
 */
exports.MEMBER_GUILD_PERMISSIONS = merge(exports.DISCUSS, [
    'ChangeNickname',
    'CreateInstantInvite',
    'Connect',
    'Speak',
    'Stream',
    'UseVAD',
]);
/** Moderation without server management. Cannot touch channels or roles. */
exports.MODERATOR_GUILD_PERMISSIONS = merge(exports.MEMBER_GUILD_PERMISSIONS, [
    'ManageMessages',
    'ManageThreads',
    'ManageNicknames',
    'ModerateMembers',
    'KickMembers',
    'BanMembers',
    'ViewAuditLog',
    'CreatePrivateThreads',
    'MuteMembers',
    'DeafenMembers',
    'MoveMembers',
]);
/**
 * Full server administration WITHOUT the Administrator bit.
 * Administrator bypasses every channel overwrite — including the ones that
 * keep #staff private — so it is reserved for @Founder alone.
 */
exports.ADMIN_GUILD_PERMISSIONS = merge(exports.MODERATOR_GUILD_PERMISSIONS, [
    'ManageChannels',
    'ManageRoles',
    'ManageGuild',
    'ManageWebhooks',
    'ManageEvents',
    'ManageGuildExpressions',
    'MentionEveryone',
]);
/* ────────────────────────────────────────────────────────────
 * Overwrite helpers — keep the blueprint declarative
 * ──────────────────────────────────────────────────────────── */
exports.everyone = { kind: 'everyone' };
exports.self = { kind: 'self' };
const role = (key) => ({ kind: 'role', role: key });
exports.role = role;
/** Deduplicating union of permission lists. */
function merge(...groups) {
    return [...new Set(groups.flat())];
}
/** Grant `perms` to every role in `roles`, one overwrite each. */
function allowRoles(roles, ...perms) {
    const allow = merge(...perms);
    return roles.map((key) => ({ target: (0, exports.role)(key), allow }));
}
/** Revoke `perms` from every role in `roles`. */
function denyRoles(roles, ...perms) {
    const deny = merge(...perms);
    return roles.map((key) => ({ target: (0, exports.role)(key), deny }));
}
/** Hide a category from everyone who is not explicitly granted access. */
exports.HIDDEN_FROM_EVERYONE = {
    target: exports.everyone,
    deny: ['ViewChannel'],
};
//# sourceMappingURL=permissionPresets.js.map