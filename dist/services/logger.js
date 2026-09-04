"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const env_1 = require("../config/env");
const format_1 = require("../utils/format");
const errors_1 = require("../utils/errors");
const resolve_1 = require("./resolve");
const LEVEL_RANK = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
};
/**
 * Console + Discord logger.
 *
 * Discord delivery is batched: provisioning a fresh server emits ~40 lines in
 * a couple of seconds, and one message per line would hit the channel rate
 * limit immediately. Lines are queued, flushed on a short timer, and the
 * transport swallows its own failures — logging must never take the bot down.
 */
class Logger {
    client = null;
    guildId = null;
    queue = [];
    timer = null;
    flushing = false;
    /** Called once the client is ready, so log lines can reach #bot-logs. */
    attach(client, guildId) {
        this.client = client;
        this.guildId = guildId;
        void this.flush();
    }
    get threshold() {
        try {
            return LEVEL_RANK[(0, env_1.env)().logLevel];
        }
        catch {
            return LEVEL_RANK.info;
        }
    }
    get discordEnabled() {
        try {
            return (0, env_1.env)().discordLogging;
        }
        catch {
            return false;
        }
    }
    log(level, scope, message, options = {}) {
        if (LEVEL_RANK[level] < this.threshold)
            return;
        const stamp = new Date().toISOString();
        const line = `${stamp} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
        if (level === 'error')
            console.error(line);
        else if (level === 'warn')
            console.warn(line);
        else
            console.log(line);
        if (options.detail)
            console.log(indent(options.detail));
        const mirror = options.discord ?? LEVEL_RANK[level] >= LEVEL_RANK.info;
        if (mirror && this.discordEnabled)
            this.enqueue(`[${scope}] ${message}`);
    }
    trace = (scope, message, options) => this.log('trace', scope, message, options);
    debug = (scope, message, options) => this.log('debug', scope, message, options);
    info = (scope, message, options) => this.log('info', scope, message, options);
    warn = (scope, message, options) => this.log('warn', scope, message, options);
    /** Logs the human-readable summary to Discord and the full detail locally. */
    error(scope, message, error) {
        this.log('error', scope, message, {
            discord: true,
            ...(error === undefined ? {} : { detail: (0, errors_1.describeError)(error) }),
        });
    }
    enqueue(line) {
        // Bound the queue so a pathological error loop cannot exhaust memory.
        if (this.queue.length >= 200)
            return;
        this.queue.push((0, format_1.truncate)(line, 400));
        this.timer ??= setTimeout(() => {
            this.timer = null;
            void this.flush();
        }, 1500);
        this.timer.unref?.();
    }
    async flush() {
        if (this.flushing || this.queue.length === 0)
            return;
        if (!this.client?.isReady() || !this.guildId)
            return;
        this.flushing = true;
        const pending = this.queue.splice(0, this.queue.length);
        try {
            const guild = await this.resolveGuild();
            const channel = guild ? (0, resolve_1.findLogChannel)(guild) : null;
            // Before /setup has run there is no #bot-logs. Console output is the
            // record for that window; dropping the queue is correct, not a failure.
            if (!channel)
                return;
            for (const chunk of (0, format_1.chunkLines)(pending, 1800)) {
                await channel.send({ content: (0, format_1.codeBlock)(chunk) });
            }
        }
        catch (error) {
            console.error('Discord log transport failed:', (0, errors_1.describeError)(error));
        }
        finally {
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
    async resolveGuild() {
        if (!this.client || !this.guildId)
            return null;
        return (this.client.guilds.cache.get(this.guildId) ??
            (await this.client.guilds.fetch(this.guildId).catch(() => null)));
    }
}
function indent(value) {
    return value
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n');
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map