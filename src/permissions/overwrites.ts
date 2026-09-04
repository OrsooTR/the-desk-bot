import {
  OverwriteType,
  PermissionsBitField,
  type Collection,
  type Guild,
  type GuildChannel,
  type OverwriteResolvable,
  type PermissionOverwrites,
  type Snowflake,
} from 'discord.js';
import type { OverwriteSpec, OverwriteTarget, PermissionKey } from '../types';
import { findRole } from '../services/resolve';

export interface ResolvedOverwrite {
  id: Snowflake;
  type: OverwriteType;
  allow: bigint;
  deny: bigint;
}

export interface ResolutionResult {
  overwrites: ResolvedOverwrite[];
  /**
   * Targets that do not exist yet — during a dry run on a fresh server this is
   * every role, because nothing has been created. The provisioner uses it to
   * report "permissions pending role creation" instead of a false diff.
   */
  missing: string[];
}

function bits(keys: PermissionKey[] | undefined): bigint {
  if (!keys || keys.length === 0) return 0n;
  return new PermissionsBitField(keys).bitfield;
}

function targetId(guild: Guild, target: OverwriteTarget, botId: Snowflake): string | null {
  switch (target.kind) {
    case 'everyone':
      return guild.roles.everyone.id;
    case 'self':
      return botId;
    case 'role':
      return findRole(guild, target.role)?.id ?? null;
  }
}

/**
 * Turn declarative specs from the blueprint into concrete Discord overwrites.
 *
 * Several specs can target the same role — a category grants DISCUSS to the
 * whole community and CURATE to staff — so grants are merged by target id.
 * Where a permission is both allowed and denied for one target, the allow
 * wins: the blueprint's pattern is a broad @everyone deny with narrower role
 * allows layered on top, and the narrower statement is the intentional one.
 */
export function resolveOverwrites(
  guild: Guild,
  specs: OverwriteSpec[],
  botId: Snowflake,
): ResolutionResult {
  return resolveLayered(guild, [specs], botId);
}

/**
 * Resolve permissions from ordered layers — category first, then channel.
 *
 * Two different rules apply, and both matter:
 *
 *  - *Within* a layer, allow beats deny. This is what lets a category say
 *    "members cannot post here" and "educators can" in one breath.
 *  - *Across* layers, the later layer wins outright. This is what lets an
 *    individual channel be stricter than its category, not merely more
 *    permissive — without it, a channel-level deny would be silently
 *    swallowed by a category-level allow, which is a nasty thing to discover
 *    six months after writing it.
 */
export function resolveLayered(
  guild: Guild,
  layers: OverwriteSpec[][],
  botId: Snowflake,
): ResolutionResult {
  const result = new Map<string, ResolvedOverwrite>();
  const missing: string[] = [];

  for (const layer of layers) {
    const collapsed = collapseLayer(guild, layer, botId, missing);

    for (const [id, current] of collapsed) {
      const previous = result.get(id);
      if (!previous) {
        result.set(id, current);
        continue;
      }
      result.set(id, {
        id,
        type: current.type,
        allow: (previous.allow & ~current.deny) | current.allow,
        deny: (previous.deny & ~current.allow) | current.deny,
      });
    }
  }

  return { overwrites: [...result.values()], missing };
}

/** Merge one layer's specs per target, with allow beating deny. */
function collapseLayer(
  guild: Guild,
  specs: OverwriteSpec[],
  botId: Snowflake,
  missing: string[],
): Map<string, ResolvedOverwrite> {
  const merged = new Map<string, ResolvedOverwrite>();

  for (const spec of specs) {
    const id = targetId(guild, spec.target, botId);
    if (!id) {
      const label = spec.target.kind === 'role' ? spec.target.role : spec.target.kind;
      if (!missing.includes(label)) missing.push(label);
      continue;
    }

    const type = spec.target.kind === 'self' ? OverwriteType.Member : OverwriteType.Role;
    const existing = merged.get(id) ?? { id, type, allow: 0n, deny: 0n };
    existing.allow |= bits(spec.allow);
    existing.deny |= bits(spec.deny);
    merged.set(id, existing);
  }

  for (const entry of merged.values()) entry.deny &= ~entry.allow;
  return merged;
}

type ExistingOverwrites = Collection<Snowflake, PermissionOverwrites>;

/**
 * Human-readable list of the differences between what we want and what exists.
 * Only managed targets are compared — an overwrite a moderator added by hand
 * for a single member is not our business.
 */
export function diffOverwrites(
  existing: ExistingOverwrites,
  desired: ResolvedOverwrite[],
): string[] {
  const reasons: string[] = [];

  for (const want of desired) {
    const have = existing.get(want.id);
    if (!have) {
      reasons.push(`missing overwrite for ${want.id}`);
      continue;
    }
    if (have.allow.bitfield !== want.allow || have.deny.bitfield !== want.deny) {
      reasons.push(`permissions drifted for ${want.id}`);
    }
  }

  return reasons;
}

/**
 * Build the full overwrite payload to write back.
 *
 * Managed targets are replaced with the blueprint's values; every other
 * existing overwrite is carried through untouched. This is what makes /setup
 * safe to re-run on a live server: manual, per-member and per-role exceptions
 * that we do not manage survive the sync.
 */
export function mergeOverwrites(
  existing: ExistingOverwrites,
  desired: ResolvedOverwrite[],
): OverwriteResolvable[] {
  const managed = new Set(desired.map((entry) => entry.id));

  const preserved: OverwriteResolvable[] = existing
    .filter((overwrite) => !managed.has(overwrite.id))
    .map((overwrite) => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: overwrite.allow.bitfield,
      deny: overwrite.deny.bitfield,
    }));

  return [...desired, ...preserved];
}

/** Convenience: does this channel already match the blueprint? */
export function channelOverwritesMatch(channel: GuildChannel, desired: ResolvedOverwrite[]): boolean {
  return diffOverwrites(channel.permissionOverwrites.cache, desired).length === 0;
}
