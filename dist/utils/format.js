"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMBED_FIELD_LIMIT = exports.EMBED_DESCRIPTION_LIMIT = exports.MESSAGE_LIMIT = void 0;
exports.truncate = truncate;
exports.chunkLines = chunkLines;
exports.codeBlock = codeBlock;
exports.plural = plural;
exports.timestamp = timestamp;
exports.escapeMarkdown = escapeMarkdown;
exports.parseUtcDateTime = parseUtcDateTime;
/** Discord's hard limit on a single message. */
exports.MESSAGE_LIMIT = 2000;
/** Discord's hard limit on an embed description. */
exports.EMBED_DESCRIPTION_LIMIT = 4096;
/** Discord's hard limit on an embed field value. */
exports.EMBED_FIELD_LIMIT = 1024;
/** Truncate with an ellipsis, never exceeding `max`. */
function truncate(value, max) {
    return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}
/**
 * Split text into chunks that fit Discord's limits, breaking on line boundaries
 * so a log block or a rules list never splits mid-sentence.
 */
function chunkLines(lines, limit = exports.MESSAGE_LIMIT) {
    const chunks = [];
    let current = '';
    for (const line of lines) {
        const piece = line.length > limit ? truncate(line, limit) : line;
        if (current.length + piece.length + 1 > limit) {
            if (current)
                chunks.push(current);
            current = piece;
        }
        else {
            current = current ? `${current}\n${piece}` : piece;
        }
    }
    if (current)
        chunks.push(current);
    return chunks;
}
/** Wrap in a fenced code block, trimming to fit. */
function codeBlock(content, language = '') {
    const fenceCost = language.length + 8;
    return `\`\`\`${language}\n${truncate(content, exports.MESSAGE_LIMIT - fenceCost)}\n\`\`\``;
}
/** `1 role` / `3 roles` — avoids the "1 roles" tell of a lazy bot. */
function plural(count, singular, pluralForm = `${singular}s`) {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
/** Discord relative/absolute timestamp markup. */
function timestamp(date, style = 'F') {
    return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}
/** Escape user-supplied text so it cannot inject markdown into an embed. */
function escapeMarkdown(value) {
    return value.replace(/([\\*_~`|>])/g, '\\$1');
}
/**
 * Parse `YYYY-MM-DD` + `HH:mm` as UTC.
 * Returns null on anything malformed — callers surface a usage hint instead of
 * silently scheduling an event in the wrong year.
 */
function parseUtcDateTime(date, time) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!dateMatch || !timeMatch)
        return null;
    const [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
    const [hour, minute] = [Number(timeMatch[1]), Number(timeMatch[2])];
    if (month < 1 || month > 12 || day < 1 || day > 31)
        return null;
    if (hour > 23 || minute > 59)
        return null;
    const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
    // Rejects impossible dates such as 2026-02-31, which Date.UTC rolls over.
    if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day)
        return null;
    return parsed;
}
//# sourceMappingURL=format.js.map