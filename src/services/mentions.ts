import type { Guild } from 'discord.js';
import { findChannel, findRole } from './resolve';

/* ────────────────────────────────────────────────────────────
 * Mention templating
 *
 * Writing "#trading-floor" in a config string produces plain grey text, not a
 * link — Discord only renders a real channel mention from `<#id>`, and the id
 * does not exist until the channel has been created.
 *
 * So config text uses placeholders instead, resolved at publish time:
 *
 *   {{#trading-floor}}  → <#123…>   a clickable channel
 *   {{@moderator}}      → <@&456…>  a role mention
 *
 * The key is the BLUEPRINT key, never the display name, so renaming a channel
 * or putting an emoji in front of it does not break a single link.
 *
 * An unresolvable placeholder degrades to readable plain text rather than
 * leaving `{{#foo}}` visible to members.
 * ──────────────────────────────────────────────────────────── */

const PATTERN = /\{\{([#@])([a-zA-Z0-9_-]+)\}\}/g;

export function resolveMentions(text: string, guild: Guild): string {
  return text.replace(PATTERN, (_match, kind: string, key: string) => {
    if (kind === '#') {
      const channel = findChannel(guild, key);
      return channel ? `<#${channel.id}>` : `#${key}`;
    }
    const role = findRole(guild, key);
    return role ? `<@&${role.id}>` : `@${key}`;
  });
}

/** Apply to every string in an object, recursively. Used on embed payloads. */
export function resolveDeep<T>(value: T, guild: Guild): T {
  if (typeof value === 'string') return resolveMentions(value, guild) as T;
  if (Array.isArray(value)) return value.map((item) => resolveDeep(item, guild)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = resolveDeep(item, guild);
    return out as T;
  }
  return value;
}
