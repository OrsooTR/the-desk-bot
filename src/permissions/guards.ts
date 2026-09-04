import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import type { RoleKey } from '../types';
import { ROLE_HIERARCHY } from '../config/server';
import { findRole } from '../services/resolve';
import { ForbiddenError } from '../utils/errors';

/**
 * The minimum standing a command requires.
 * `everyone` still means "a member of this guild" — commands are guild-only.
 */
export type AccessLevel = RoleKey | 'everyone';

const RANK = new Map<RoleKey, number>(ROLE_HIERARCHY.map((key, index) => [key, index]));

function rankOf(key: RoleKey): number {
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
export function memberMeets(member: GuildMember, level: AccessLevel): boolean {
  if (level === 'everyone') return true;
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const required = rankOf(level);

  // `bot` sits at the bottom of the hierarchy and grants nothing; it must never
  // satisfy a requirement by being numerically "above" something.
  return ROLE_HIERARCHY.some((key) => {
    if (key === 'bot') return false;
    if (rankOf(key) > required) return false;
    const role = findRole(member.guild, key);
    return role ? member.roles.cache.has(role.id) : false;
  });
}

/** Throws a user-safe error when the member does not meet `level`. */
export function assertAccess(member: GuildMember, level: AccessLevel, commandName: string): void {
  if (memberMeets(member, level)) return;
  throw new ForbiddenError(
    `\`/${commandName}\` requires **${labelFor(level)}** or above.`,
  );
}

function labelFor(level: AccessLevel): string {
  if (level === 'everyone') return 'Member';
  const definition = ROLE_HIERARCHY.includes(level) ? level : 'member';
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
export function canActOn(
  actor: GuildMember,
  target: GuildMember,
): { ok: true } | { ok: false; reason: string } {
  if (actor.id === target.id) return { ok: false, reason: 'You cannot moderate yourself.' };
  if (target.id === target.guild.ownerId)
    return { ok: false, reason: 'The server owner cannot be moderated.' };

  if (actor.id !== actor.guild.ownerId && actor.roles.highest.position <= target.roles.highest.position)
    return { ok: false, reason: 'That member has a role equal to or above yours.' };

  const me = target.guild.members.me;
  if (!me) return { ok: false, reason: 'I could not resolve my own membership in this server.' };
  if (me.roles.highest.position <= target.roles.highest.position)
    return {
      ok: false,
      reason: 'That member is above me in the role list, so I cannot act on them.',
    };

  return { ok: true };
}
