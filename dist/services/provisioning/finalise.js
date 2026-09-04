"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finaliseSetup = finaliseSetup;
const automod_1 = require("../automod");
const content_1 = require("../content");
const logger_1 = require("../logger");
const publishing_1 = require("../publishing");
/**
 * Everything that happens after the structure exists.
 *
 * Kept out of the provisioner because it is a different kind of work: the
 * provisioner reconciles Discord *resources*, this fills them with content and
 * turns on the filters. Separating them means a content failure can never
 * leave the channel structure half-built.
 *
 * Every step is idempotent and every step is optional — a failure is recorded
 * as a warning and the rest continues.
 */
async function finaliseSetup(guild, report, dryRun) {
    await step(report, 'welcome and rules', async () => {
        const results = await (0, content_1.publishCommunityContent)(guild, dryRun);
        return results.map((result) => ({
            key: result.key,
            status: result.status,
            ...(result.detail ? { detail: result.detail } : {}),
        }));
    });
    await step(report, 'channel guides', () => (0, publishing_1.publishChannelGuides)(guild, dryRun));
    await step(report, 'role panels', () => (0, publishing_1.publishRolePanels)(guild, dryRun));
    await step(report, 'FAQ', () => (0, publishing_1.publishFaq)(guild, dryRun));
    await step(report, 'server description', async () => [
        await (0, publishing_1.publishGuildDescription)(guild, dryRun),
    ]);
    await step(report, 'AutoMod rules', async () => {
        const outcomes = await (0, automod_1.syncAutoMod)(guild, dryRun);
        return outcomes.map((outcome) => ({
            key: outcome.name,
            status: outcome.status,
            ...(outcome.detail ? { detail: outcome.detail } : {}),
        }));
    });
}
async function step(report, label, run) {
    try {
        const results = await run();
        const counts = new Map();
        for (const result of results)
            counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
        const summary = [...counts.entries()]
            .map(([status, count]) => `${count} ${status}`)
            .join(', ');
        report.notes.push(`${label}: ${summary || 'nothing to do'}`);
        // Anything skipped or failed needs a human to see the reason, not a count.
        for (const result of results) {
            if ((result.status === 'skipped' || result.status === 'failed') && result.detail) {
                report.warnings.push(`${label} — ${result.key}: ${result.detail}`);
            }
        }
    }
    catch (error) {
        report.warnings.push(`${label} could not be completed.`);
        logger_1.logger.error('SETUP', `Finalisation step "${label}" failed`, error);
    }
}
//# sourceMappingURL=finalise.js.map