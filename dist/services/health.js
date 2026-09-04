"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHealthServer = startHealthServer;
const node_http_1 = require("node:http");
const logger_1 = require("./logger");
/**
 * Optional HTTP health endpoint, enabled by setting HEALTH_PORT.
 *
 * A Discord bot needs no inbound connection — it opens an outbound WebSocket
 * and that is all. But several hosting platforms (Render web services, Koyeb,
 * some free panels) will kill a process that does not bind a port, because
 * their health check expects an HTTP response. This exists purely to satisfy
 * them, and stays off unless asked for.
 *
 * The response carries no guild names, user data or configuration — only
 * whether the gateway is connected, how long the process has been up, and the
 * WebSocket latency.
 */
function startHealthServer(client, port) {
    const server = (0, node_http_1.createServer)((request, response) => {
        if (request.url !== '/' && request.url !== '/health') {
            response.writeHead(404).end();
            return;
        }
        const ready = client.isReady();
        const body = JSON.stringify({
            status: ready ? 'ok' : 'starting',
            uptimeSeconds: Math.floor(process.uptime()),
            gatewayPingMs: ready ? Math.round(client.ws.ping) : null,
        });
        response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' }).end(body);
    });
    server.on('error', (error) => {
        logger_1.logger.error('BOOT', `Health server failed on port ${port}`, error);
    });
    server.listen(port, () => {
        logger_1.logger.info('BOOT', `Health endpoint listening on :${port}`, { discord: false });
    });
    return server;
}
//# sourceMappingURL=health.js.map