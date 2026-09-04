"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMentions = resolveMentions;
exports.resolveDeep = resolveDeep;
const resolve_1 = require("./resolve");
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
function resolveMentions(text, guild) {
    return text.replace(PATTERN, (_match, kind, key) => {
        if (kind === '#') {
            const channel = (0, resolve_1.findChannel)(guild, key);
            return channel ? `<#${channel.id}>` : `#${key}`;
        }
        const role = (0, resolve_1.findRole)(guild, key);
        return role ? `<@&${role.id}>` : `@${key}`;
    });
}
/** Apply to every string in an object, recursively. Used on embed payloads. */
function resolveDeep(value, guild) {
    if (typeof value === 'string')
        return resolveMentions(value, guild);
    if (Array.isArray(value))
        return value.map((item) => resolveDeep(item, guild));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, item] of Object.entries(value))
            out[key] = resolveDeep(item, guild);
        return out;
    }
    return value;
}
//# sourceMappingURL=mentions.js.map