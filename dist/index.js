"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const client_1 = require("./core/client");
const events_1 = require("./events");
const health_1 = require("./services/health");
const logger_1 = require("./services/logger");
const errors_1 = require("./utils/errors");
/** Held so shutdown can close it cleanly. Null unless HEALTH_PORT is set. */
let healthServer = null;
/**
 * THE DESK — entry point.
 *
 * Boot order: validate configuration, build the client, wire handlers, then
 * connect. Configuration problems therefore surface as one readable message
 * before a single network call is made.
 */
async function main() {
    const config = (0, env_1.env)();
    const client = (0, client_1.createClient)();
    (0, events_1.registerEventHandlers)(client);
    installProcessHandlers(client);
    if (config.healthPort !== null) {
        healthServer = (0, health_1.startHealthServer)(client, config.healthPort);
    }
    logger_1.logger.info('BOOT', `Starting in ${config.nodeEnv} mode`, { discord: false });
    try {
        await client.login(config.token);
    }
    catch (error) {
        // Tear the client down before exiting: killing the process with sockets
        // still open is what produces those unreadable libuv assertions.
        console.error('Fatal startup error:');
        console.error((0, errors_1.describeError)(error));
        await client.destroy().catch(() => undefined);
        process.exitCode = 1;
    }
}
/**
 * The bot must survive its own bugs. An unhandled rejection in a background
 * task is logged and the process keeps serving; only an uncaught exception,
 * which leaves the runtime in an unknown state, is treated as fatal.
 */
function installProcessHandlers(client) {
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.error('ERROR', 'Unhandled promise rejection', reason);
    });
    process.on('uncaughtException', (error) => {
        logger_1.logger.error('ERROR', 'Uncaught exception — shutting down', error);
        void shutdown(client, 1);
    });
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => {
            logger_1.logger.info('BOOT', `Received ${signal} — shutting down`, { discord: false });
            void shutdown(client, 0);
        });
    }
}
async function shutdown(client, code) {
    try {
        healthServer?.close();
        await client.destroy();
    }
    catch (error) {
        console.error('Error during shutdown:', (0, errors_1.describeError)(error));
    }
    finally {
        process.exit(code);
    }
}
main().catch((error) => {
    // Configuration failures land here, before anything is connected, so the
    // console is the only place this can go.
    console.error('Fatal startup error:');
    console.error((0, errors_1.describeError)(error));
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map