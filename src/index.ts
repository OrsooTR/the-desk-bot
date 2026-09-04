import type { Server } from 'node:http';
import type { Client } from 'discord.js';
import { env } from './config/env';
import { createClient } from './core/client';
import { registerEventHandlers } from './events';
import { startHealthServer } from './services/health';
import { logger } from './services/logger';
import { describeError } from './utils/errors';

/** Held so shutdown can close it cleanly. Null unless HEALTH_PORT is set. */
let healthServer: Server | null = null;

/**
 * THE DESK — entry point.
 *
 * Boot order: validate configuration, build the client, wire handlers, then
 * connect. Configuration problems therefore surface as one readable message
 * before a single network call is made.
 */
async function main(): Promise<void> {
  const config = env();

  const client = createClient();
  registerEventHandlers(client);
  installProcessHandlers(client);

  if (config.healthPort !== null) {
    healthServer = startHealthServer(client, config.healthPort);
  }

  logger.info('BOOT', `Starting in ${config.nodeEnv} mode`, { discord: false });

  try {
    await client.login(config.token);
  } catch (error) {
    // Tear the client down before exiting: killing the process with sockets
    // still open is what produces those unreadable libuv assertions.
    console.error('Fatal startup error:');
    console.error(describeError(error));
    await client.destroy().catch(() => undefined);
    process.exitCode = 1;
  }
}

/**
 * The bot must survive its own bugs. An unhandled rejection in a background
 * task is logged and the process keeps serving; only an uncaught exception,
 * which leaves the runtime in an unknown state, is treated as fatal.
 */
function installProcessHandlers(client: Client): void {
  process.on('unhandledRejection', (reason) => {
    logger.error('ERROR', 'Unhandled promise rejection', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('ERROR', 'Uncaught exception — shutting down', error);
    void shutdown(client, 1);
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      logger.info('BOOT', `Received ${signal} — shutting down`, { discord: false });
      void shutdown(client, 0);
    });
  }
}

async function shutdown(client: Client, code: number): Promise<void> {
  try {
    healthServer?.close();
    await client.destroy();
  } catch (error) {
    console.error('Error during shutdown:', describeError(error));
  } finally {
    process.exit(code);
  }
}

main().catch((error: unknown) => {
  // Configuration failures land here, before anything is connected, so the
  // console is the only place this can go.
  console.error('Fatal startup error:');
  console.error(describeError(error));
  process.exitCode = 1;
});
