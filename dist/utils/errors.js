"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.MissingBotPermissionError = exports.OperationalError = void 0;
exports.toUserMessage = toUserMessage;
exports.describeError = describeError;
exports.isPermissionError = isPermissionError;
const discord_js_1 = require("discord.js");
/**
 * An error whose message is safe to show a user in Discord.
 * Anything that is NOT an OperationalError gets replaced with a generic
 * message before it reaches a channel — stack traces and API internals stay
 * in the logs.
 */
class OperationalError extends Error {
    hint;
    constructor(message, hint) {
        super(message);
        this.hint = hint;
        this.name = 'OperationalError';
    }
}
exports.OperationalError = OperationalError;
/** The bot lacks a Discord permission it needs to do the requested thing. */
class MissingBotPermissionError extends OperationalError {
    constructor(action, permission) {
        super(`I do not have permission to ${action}.`, `Grant the bot the **${permission}** permission, and make sure its role sits above the roles it manages.`);
        this.name = 'MissingBotPermissionError';
    }
}
exports.MissingBotPermissionError = MissingBotPermissionError;
/** The invoking user is not allowed to run this command. */
class ForbiddenError extends OperationalError {
    constructor(message = 'You do not have permission to use this command.') {
        super(message);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
const FRIENDLY_API_ERRORS = {
    [discord_js_1.RESTJSONErrorCodes.MissingPermissions]: 'Discord refused the action: the bot is missing a required permission.',
    [discord_js_1.RESTJSONErrorCodes.MissingAccess]: 'Discord refused the action: the bot cannot access that channel or resource.',
    [discord_js_1.RESTJSONErrorCodes.UnknownChannel]: 'That channel no longer exists. Run `/setup` to restore it.',
    [discord_js_1.RESTJSONErrorCodes.UnknownRole]: 'That role no longer exists. Run `/setup` to restore it.',
    [discord_js_1.RESTJSONErrorCodes.UnknownMember]: 'That member is not in this server.',
    [discord_js_1.RESTJSONErrorCodes.UnknownUser]: 'That user does not exist.',
    [discord_js_1.RESTJSONErrorCodes.UnknownMessage]: 'That message no longer exists.',
    [discord_js_1.RESTJSONErrorCodes.CannotExecuteActionOnSystemMessage]: 'That action cannot be performed on a system message.',
    [discord_js_1.RESTJSONErrorCodes.MaximumNumberOfGuildChannelsReached]: 'This server has reached Discord’s channel limit.',
    [discord_js_1.RESTJSONErrorCodes.MaximumNumberOfGuildRolesReached]: 'This server has reached Discord’s role limit (250).',
};
/**
 * Converts anything thrown into a message that is safe to display in Discord.
 * Never leaks tokens, stack traces or raw API payloads.
 */
function toUserMessage(error) {
    if (error instanceof OperationalError) {
        return error.hint ? { message: error.message, hint: error.hint } : { message: error.message };
    }
    if (error instanceof discord_js_1.DiscordAPIError) {
        const code = typeof error.code === 'number' ? error.code : undefined;
        const friendly = code !== undefined ? FRIENDLY_API_ERRORS[code] : undefined;
        return {
            message: friendly ?? 'Discord rejected the request.',
            hint: `Discord error ${String(error.code)}. The details are in the bot logs.`,
        };
    }
    if (error instanceof discord_js_1.HTTPError) {
        return {
            message: 'Discord is not responding correctly right now.',
            hint: 'This is usually transient. Try again in a moment.',
        };
    }
    return {
        message: 'Something went wrong while running that command.',
        hint: 'The details have been written to the bot logs.',
    };
}
/** Full detail for the log transport. Never sent to a public channel verbatim. */
function describeError(error) {
    if (error instanceof discord_js_1.DiscordAPIError) {
        return `DiscordAPIError ${String(error.code)} on ${error.method} ${error.url}: ${error.message}`;
    }
    if (error instanceof Error) {
        return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
    }
    return `Non-error thrown: ${safeStringify(error)}`;
}
function safeStringify(value) {
    try {
        return JSON.stringify(value) ?? String(value);
    }
    catch {
        return String(value);
    }
}
/** True when the failure was Discord telling us we lack permission. */
function isPermissionError(error) {
    return (error instanceof discord_js_1.DiscordAPIError &&
        (error.code === discord_js_1.RESTJSONErrorCodes.MissingPermissions ||
            error.code === discord_js_1.RESTJSONErrorCodes.MissingAccess));
}
//# sourceMappingURL=errors.js.map