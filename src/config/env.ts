import 'dotenv/config';

export interface AppEnv {
  token: string;
  clientId: string;
  guildId: string;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  autoDeployCommands: boolean;
  discordLogging: boolean;
  stateFile: string;
  nodeEnv: 'development' | 'production';
  /**
   * When set, bind a small HTTP health endpoint. Only needed on hosts that
   * require a listening port to consider the process alive.
   */
  healthPort: number | null;
}

class MissingEnvError extends Error {
  constructor(missing: string[]) {
    super(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
        'Copy .env.example to .env and fill in the values.',
    );
    this.name = 'MissingEnvError';
  }
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;

function logLevel(value: string | undefined): AppEnv['logLevel'] {
  const candidate = (value ?? 'info').trim().toLowerCase();
  return (LOG_LEVELS as readonly string[]).includes(candidate)
    ? (candidate as AppEnv['logLevel'])
    : 'info';
}

/**
 * Reads and validates the environment. Throws once, loudly, with every missing
 * key listed — rather than failing later with an opaque Discord API error.
 */
export function loadEnv(): AppEnv {
  const required = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value || value.trim() === '')
    .map(([key]) => key);

  if (missing.length > 0) throw new MissingEnvError(missing);

  return {
    token: required.DISCORD_TOKEN as string,
    clientId: required.CLIENT_ID as string,
    guildId: required.GUILD_ID as string,
    logLevel: logLevel(process.env.LOG_LEVEL),
    autoDeployCommands: bool(process.env.AUTO_DEPLOY_COMMANDS, true),
    discordLogging: bool(process.env.DISCORD_LOGGING, true),
    stateFile: process.env.STATE_FILE?.trim() || 'data/state.json',
    nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    // Many platforms inject PORT rather than a name of our choosing.
    healthPort: port(process.env.HEALTH_PORT ?? process.env.PORT),
  };
}

function port(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : null;
}

let cached: AppEnv | null = null;

/** Memoised accessor so validation runs exactly once per process. */
export function env(): AppEnv {
  cached ??= loadEnv();
  return cached;
}
