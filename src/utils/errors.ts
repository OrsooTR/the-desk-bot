import { DiscordAPIError, HTTPError, RESTJSONErrorCodes } from 'discord.js';

/**
 * An error whose message is safe to show a user in Discord.
 * Anything that is NOT an OperationalError gets replaced with a generic
 * message before it reaches a channel — stack traces and API internals stay
 * in the logs.
 */
export class OperationalError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'OperationalError';
  }
}

/** The bot lacks a Discord permission it needs to do the requested thing. */
export class MissingBotPermissionError extends OperationalError {
  constructor(action: string, permission: string) {
    super(
      `I do not have permission to ${action}.`,
      `Grant the bot the **${permission}** permission, and make sure its role sits above the roles it manages.`,
    );
    this.name = 'MissingBotPermissionError';
  }
}

/** The invoking user is not allowed to run this command. */
export class ForbiddenError extends OperationalError {
  constructor(message = 'You do not have permission to use this command.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

const FRIENDLY_API_ERRORS: Partial<Record<number, string>> = {
  [RESTJSONErrorCodes.MissingPermissions]:
    'Discord refused the action: the bot is missing a required permission.',
  [RESTJSONErrorCodes.MissingAccess]:
    'Discord refused the action: the bot cannot access that channel or resource.',
  [RESTJSONErrorCodes.UnknownChannel]: 'That channel no longer exists. Run `/setup` to restore it.',
  [RESTJSONErrorCodes.UnknownRole]: 'That role no longer exists. Run `/setup` to restore it.',
  [RESTJSONErrorCodes.UnknownMember]: 'That member is not in this server.',
  [RESTJSONErrorCodes.UnknownUser]: 'That user does not exist.',
  [RESTJSONErrorCodes.UnknownMessage]: 'That message no longer exists.',
  [RESTJSONErrorCodes.CannotExecuteActionOnSystemMessage]:
    'That action cannot be performed on a system message.',
  [RESTJSONErrorCodes.MaximumNumberOfGuildChannelsReached]:
    'This server has reached Discord’s channel limit.',
  [RESTJSONErrorCodes.MaximumNumberOfGuildRolesReached]:
    'This server has reached Discord’s role limit (250).',
};

/**
 * Converts anything thrown into a message that is safe to display in Discord.
 * Never leaks tokens, stack traces or raw API payloads.
 */
export function toUserMessage(error: unknown): { message: string; hint?: string } {
  if (error instanceof OperationalError) {
    return error.hint ? { message: error.message, hint: error.hint } : { message: error.message };
  }

  if (error instanceof DiscordAPIError) {
    const code = typeof error.code === 'number' ? error.code : undefined;
    const friendly = code !== undefined ? FRIENDLY_API_ERRORS[code] : undefined;
    return {
      message: friendly ?? 'Discord rejected the request.',
      hint: `Discord error ${String(error.code)}. The details are in the bot logs.`,
    };
  }

  if (error instanceof HTTPError) {
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
export function describeError(error: unknown): string {
  if (error instanceof DiscordAPIError) {
    return `DiscordAPIError ${String(error.code)} on ${error.method} ${error.url}: ${error.message}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  }
  return `Non-error thrown: ${safeStringify(error)}`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** True when the failure was Discord telling us we lack permission. */
export function isPermissionError(error: unknown): boolean {
  return (
    error instanceof DiscordAPIError &&
    (error.code === RESTJSONErrorCodes.MissingPermissions ||
      error.code === RESTJSONErrorCodes.MissingAccess)
  );
}
