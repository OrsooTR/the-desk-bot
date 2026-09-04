"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = loadEnv;
exports.env = env;
require("dotenv/config");
class MissingEnvError extends Error {
    constructor(missing) {
        super(`Missing required environment variable(s): ${missing.join(', ')}.\n` +
            'Copy .env.example to .env and fill in the values.');
        this.name = 'MissingEnvError';
    }
}
function bool(value, fallback) {
    if (value === undefined || value.trim() === '')
        return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'];
function logLevel(value) {
    const candidate = (value ?? 'info').trim().toLowerCase();
    return LOG_LEVELS.includes(candidate)
        ? candidate
        : 'info';
}
/**
 * Reads and validates the environment. Throws once, loudly, with every missing
 * key listed — rather than failing later with an opaque Discord API error.
 */
function loadEnv() {
    const required = {
        DISCORD_TOKEN: process.env.DISCORD_TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        GUILD_ID: process.env.GUILD_ID,
    };
    const missing = Object.entries(required)
        .filter(([, value]) => !value || value.trim() === '')
        .map(([key]) => key);
    if (missing.length > 0)
        throw new MissingEnvError(missing);
    return {
        token: required.DISCORD_TOKEN,
        clientId: required.CLIENT_ID,
        guildId: required.GUILD_ID,
        logLevel: logLevel(process.env.LOG_LEVEL),
        autoDeployCommands: bool(process.env.AUTO_DEPLOY_COMMANDS, true),
        discordLogging: bool(process.env.DISCORD_LOGGING, true),
        stateFile: process.env.STATE_FILE?.trim() || 'data/state.json',
        nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        // Many platforms inject PORT rather than a name of our choosing.
        healthPort: port(process.env.HEALTH_PORT ?? process.env.PORT),
    };
}
function port(value) {
    if (value === undefined || value.trim() === '')
        return null;
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : null;
}
let cached = null;
/** Memoised accessor so validation runs exactly once per process. */
function env() {
    cached ??= loadEnv();
    return cached;
}
//# sourceMappingURL=env.js.map