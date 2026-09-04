"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = exports.COMMANDS = void 0;
const command_1 = require("../core/command");
const serverStatus_1 = require("./admin/serverStatus");
const setup_1 = require("./admin/setup");
const setupDryRun_1 = require("./admin/setupDryRun");
const event_1 = require("./community/event");
const faq_1 = require("./community/faq");
const resources_1 = require("./community/resources");
const review_1 = require("./community/review");
const news_1 = require("./community/news");
const ticket_1 = require("./community/ticket");
const ban_1 = require("./moderation/ban");
const clear_1 = require("./moderation/clear");
const funded_1 = require("./moderation/funded");
const kick_1 = require("./moderation/kick");
const timeout_1 = require("./moderation/timeout");
const warn_1 = require("./moderation/warn");
const warnings_1 = require("./moderation/warnings");
/**
 * Every command the bot exposes.
 *
 * Adding one is a two-line change: implement it, then list it here. The
 * registry validates for duplicate names at construction, and both the
 * dispatcher and the deploy script read from this single list — they cannot
 * drift apart.
 */
exports.COMMANDS = [
    // Administration
    setup_1.setupCommand,
    setupDryRun_1.setupDryRunCommand,
    serverStatus_1.serverStatusCommand,
    // Moderation
    warn_1.warnCommand,
    warnings_1.warningsCommand,
    funded_1.fundedCommand,
    clear_1.clearCommand,
    kick_1.kickCommand,
    ban_1.banCommand,
    timeout_1.timeoutCommand,
    // Community
    event_1.eventCommand,
    review_1.reviewCommand,
    resources_1.resourcesCommand,
    faq_1.faqCommand,
    ticket_1.ticketCommand,
    news_1.newsCommand,
];
exports.registry = new command_1.CommandRegistry(exports.COMMANDS);
//# sourceMappingURL=index.js.map