import type { OverwriteSpec, OverwriteTarget, PermissionKey, RoleKey } from '../types';

/* ────────────────────────────────────────────────────────────
 * Permission bundles
 *
 * Discord roles do NOT inherit from each other, so every bundle is expressed
 * as a complete set and composed with `merge()`. Keeping them here means a
 * permission change is a one-line edit, not a sweep through the blueprint.
 * ──────────────────────────────────────────────────────────── */

/** See a channel and its history. The minimum useful grant. */
export const READ: PermissionKey[] = ['ViewChannel', 'ReadMessageHistory'];

/** Reactions and expression. Harmless without ViewChannel. */
export const REACT: PermissionKey[] = ['AddReactions', 'UseExternalEmojis', 'UseExternalStickers'];

/** Post a top-level message with attachments/links. */
export const POST: PermissionKey[] = [
  'SendMessages',
  'EmbedLinks',
  'AttachFiles',
  'UseApplicationCommands',
];

/** Reply inside an existing thread. */
export const THREAD_REPLY: PermissionKey[] = ['SendMessagesInThreads'];

/** Open a new public thread. */
export const THREAD_CREATE: PermissionKey[] = ['CreatePublicThreads', 'SendMessagesInThreads'];

/** A plain, fully-participating community member in a discussion channel. */
export const DISCUSS: PermissionKey[] = merge(READ, REACT, POST, THREAD_CREATE);

/**
 * A restricted first-post grant for unverified accounts: they can talk, but
 * cannot post links or files. Removes the highest-value spam vector while
 * still letting a newcomer say hello.
 */
export const DISCUSS_UNVERIFIED: PermissionKey[] = merge(READ, ['AddReactions'], [
  'SendMessages',
  'UseApplicationCommands',
]);

/** Curate a channel: pin, delete, tidy threads. Granted per-channel, not globally. */
export const CURATE: PermissionKey[] = ['ManageMessages', 'ManageThreads'];

/** Join and participate in a voice room. */
export const VOICE: PermissionKey[] = merge(READ, REACT, [
  'Connect',
  'Speak',
  'Stream',
  'UseVAD',
  'SendMessages',
  'UseApplicationCommands',
]);

/** Run a live session: mute, move, and cut through the noise. */
export const VOICE_HOST: PermissionKey[] = [
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
export const STAGE_AUDIENCE: PermissionKey[] = merge(READ, REACT, [
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
export const STAGE_HOST: PermissionKey[] = merge(STAGE_AUDIENCE, [
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
export const MEMBER_GUILD_PERMISSIONS: PermissionKey[] = merge(DISCUSS, [
  'ChangeNickname',
  'CreateInstantInvite',
  'Connect',
  'Speak',
  'Stream',
  'UseVAD',
]);

/** Moderation without server management. Cannot touch channels or roles. */
export const MODERATOR_GUILD_PERMISSIONS: PermissionKey[] = merge(MEMBER_GUILD_PERMISSIONS, [
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
export const ADMIN_GUILD_PERMISSIONS: PermissionKey[] = merge(MODERATOR_GUILD_PERMISSIONS, [
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

export const everyone: OverwriteTarget = { kind: 'everyone' };
export const self: OverwriteTarget = { kind: 'self' };
export const role = (key: RoleKey): OverwriteTarget => ({ kind: 'role', role: key });

/** Deduplicating union of permission lists. */
export function merge(...groups: PermissionKey[][]): PermissionKey[] {
  return [...new Set(groups.flat())];
}

/** Grant `perms` to every role in `roles`, one overwrite each. */
export function allowRoles(roles: RoleKey[], ...perms: PermissionKey[][]): OverwriteSpec[] {
  const allow = merge(...perms);
  return roles.map((key) => ({ target: role(key), allow }));
}

/** Revoke `perms` from every role in `roles`. */
export function denyRoles(roles: RoleKey[], ...perms: PermissionKey[][]): OverwriteSpec[] {
  const deny = merge(...perms);
  return roles.map((key) => ({ target: role(key), deny }));
}

/** Hide a category from everyone who is not explicitly granted access. */
export const HIDDEN_FROM_EVERYONE: OverwriteSpec = {
  target: everyone,
  deny: ['ViewChannel'],
};
