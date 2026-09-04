import type { Client, Guild } from 'discord.js';
import { env } from '../config/env';
import { chunkLines, codeBlock, truncate } from '../utils/format';
import { describeError } from '../utils/errors';
import { findLogChannel } from './resolve';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** Scopes match the tags that appear in #bot-logs, e.g. `[SETUP]`. */
export type LogScope =
  | 'BOOT'
  | 'SETUP'
  | 'PERMISSIONS'
  | 'COMMAND'
  | 'MODERATION'
  | 'EVENT'
  | 'MEMBER'
  | 'STATE'
  | 'ERROR';

const LEVEL_RANK: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

export interface LogOptions {
  /** Mirror this line into #bot-logs. Defaults to true for info and above. */
  discord?: boolean;
  /** Extra detail written to the console only — never to Discord. */
  detail?: string;
}

/**
 * Console + Discord logger.
 *
 * Discord delivery is batched: provisioning a fresh server emits ~40 lines in
 * a couple of seconds, and one message per line would hit the channel rate
 * limit immediately. Lines are queued, flushed on a short timer, and the
 * transport swallows its own failures — logging must never take the bot down.
 */
class Logger {
  private client: Client | null = null;
  private guildId: string | null = null;
  private queue: string[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  /** Called once the client is ready, so log lines can reach #bot-logs. */
  attach(client: Client, guildId: string): void {
    this.client = client;
    this.guildId = guildId;
    void this.flush();
  }

  private get threshold(): number {
    try {
      return LEVEL_RANK[env().logLevel];
    } catch {
      return LEVEL_RANK.info;
    }
  }

  private get discordEnabled(): boolean {
    try {
      return env().discordLogging;
    } catch {
      return false;
    }
  }

  log(level: LogLevel, scope: LogScope, message: string, options: LogOptions = {}): void {
    if (LEVEL_RANK[level] < this.threshold) return;

    const stamp = new Date().toISOString();
    const line = `${stamp} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);

    if (options.detail) console.log(indent(options.detail));

    const mirror = options.discord ?? LEVEL_RANK[level] >= LEVEL_RANK.info;
    if (mirror && this.discordEnabled) this.enqueue(`[${scope}] ${message}`);
  }

  trace = (scope: LogScope, message: string, options?: LogOptions) =>
    this.log('trace', scope, message, options);
  debug = (scope: LogScope, message: string, options?: LogOptions) =>
    this.log('debug', scope, message, options);
  info = (scope: LogScope, message: string, options?: LogOptions) =>
    this.log('info', scope, message, options);
  warn = (scope: LogScope, message: string, options?: LogOptions) =>
    this.log('warn', scope, message, options);

  /** Logs the human-readable summary to Discord and the full detail locally. */
  error(scope: LogScope, message: string, error?: unknown): void {
    this.log('error', scope, message, {
      discord: true,
      ...(error === undefined ? {} : { detail: describeError(error) }),
    });
  }

  private enqueue(line: string): void {
    // Bound the queue so a pathological error loop cannot exhaust memory.
    if (this.queue.length >= 200) return;
    this.queue.push(truncate(line, 400));

    this.timer ??= setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, 1500);
    this.timer.unref?.();
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    if (!this.client?.isReady() || !this.guildId) return;

    this.flushing = true;
    const pending = this.queue.splice(0, this.queue.length);

    try {
      const guild = await this.resolveGuild();
      const channel = guild ? findLogChannel(guild) : null;
      // Before /setup has run there is no #bot-logs. Console output is the
      // record for that window; dropping the queue is correct, not a failure.
      if (!channel) return;

      for (const chunk of chunkLines(pending, 1800)) {
        await channel.send({ content: codeBlock(chunk) });
      }
    } catch (error) {
      console.error('Discord log transport failed:', describeError(error));
    } finally {
      this.flushing = false;
      if (this.queue.length > 0) {
        this.timer ??= setTimeout(() => {
          this.timer = null;
          void this.flush();
        }, 2000);
        this.timer.unref?.();
      }
    }
  }

  private async resolveGuild(): Promise<Guild | null> {
    if (!this.client || !this.guildId) return null;
    return (
      this.client.guilds.cache.get(this.guildId) ??
      (await this.client.guilds.fetch(this.guildId).catch(() => null))
    );
  }
}

function indent(value: string): string {
  return value
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

export const logger = new Logger();
