"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const env_1 = require("../config/env");
const finalise_1 = require("../services/provisioning/finalise");
const logger_1 = require("../services/logger");
const provisioner_1 = require("../services/provisioning/provisioner");
const types_1 = require("../services/provisioning/types");
const state_1 = require("../services/state");
const errors_1 = require("../utils/errors");
/* ────────────────────────────────────────────────────────────
 * Provision the server from the command line.
 *
 *   npm run setup:dry     — show what would change, write nothing
 *   npm run setup         — apply it
 *
 * The slash commands remain the normal way to do this. This exists for two
 * situations the in-Discord path cannot cover: bootstrapping a server before
 * command registration has propagated, and recovering when something is wrong
 * enough that /setup itself will not run.
 *
 * It calls exactly the same syncServer() as /setup — there is no second
 * implementation of the provisioning logic.
 *
 * Note the intents: Guilds only. The CLI has no need for GuildMembers, and
 * requesting a privileged intent that has not been enabled in the Developer
 * Portal would make login fail outright — a pointless way to block a setup.
 * ──────────────────────────────────────────────────────────── */
const dryRun = process.argv.includes('--dry-run');
async function main() {
    const { token, guildId } = (0, env_1.env)();
    const client = new discord_js_1.Client({ intents: [discord_js_1.GatewayIntentBits.Guilds] });
    await new Promise((resolve, reject) => {
        client.once('clientReady', () => resolve());
        client.once('error', reject);
        client.login(token).catch(reject);
    });
    const tag = client.user?.tag ?? 'unknown';
    console.log(`\nConnected as ${tag}`);
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
        throw new Error(`I am not a member of guild ${guildId}. Check GUILD_ID, or invite the bot to the server.`);
    }
    const full = await guild.fetch();
    console.log(`Target server: ${full.name}`);
    console.log(dryRun ? 'Mode: DRY RUN — nothing will be written\n' : 'Mode: APPLY\n');
    // Logging to #bot-logs is pointless during a dry run and before the channel
    // exists; the console is the record here either way.
    if (!dryRun)
        logger_1.logger.attach(client, guildId);
    const report = await (0, provisioner_1.syncServer)(full, { dryRun, actorTag: `CLI (${tag})` });
    await (0, finalise_1.finaliseSetup)(full, report, dryRun);
    if (!dryRun)
        state_1.state.recordSetup(full.id, client.user?.id ?? 'cli');
    print(report);
    // Give the batched log transport a moment to flush before disconnecting.
    if (!dryRun)
        await new Promise((resolve) => setTimeout(resolve, 2500));
    await client.destroy();
    if ((0, types_1.countAll)(report).failed > 0)
        process.exitCode = 1;
}
function print(report) {
    const rule = '─'.repeat(64);
    const verb = report.dryRun ? 'would be created' : 'created';
    const updateVerb = report.dryRun ? 'would be updated' : 'updated';
    console.log(rule);
    console.log(report.dryRun ? 'DRY RUN REPORT' : 'SETUP REPORT');
    console.log(rule);
    for (const kind of ['role', 'category', 'channel']) {
        const counts = (0, types_1.countByKind)(report, kind);
        console.log(`${kind.padEnd(9)} ${String(counts.created).padStart(3)} ${verb}` +
            `   ${String(counts.updated).padStart(3)} ${updateVerb}` +
            `   ${String(counts.unchanged).padStart(3)} already correct` +
            (counts.failed > 0 ? `   ${counts.failed} FAILED` : ''));
    }
    section('CREATED', report, 'created');
    section('UPDATED', report, 'updated');
    section('FAILED', report, 'failed');
    if (report.notes.length > 0) {
        console.log('\nNOTES');
        for (const note of report.notes)
            console.log(`  · ${note}`);
    }
    if (report.warnings.length > 0) {
        console.log('\nWARNINGS');
        for (const warning of report.warnings)
            console.log(`  ! ${warning}`);
    }
    if (report.unmanagedChannels.length > 0) {
        console.log('\nNOT IN THE BLUEPRINT (left untouched)');
        console.log(`  ${report.unmanagedChannels.join(', ')}`);
    }
    const totals = (0, types_1.countAll)(report);
    console.log(`\n${rule}`);
    if (totals.created === 0 && totals.updated === 0 && totals.failed === 0) {
        console.log('All required resources already exist. Nothing was changed.');
    }
    console.log(`Completed in ${report.durationMs}ms.`);
    console.log(rule);
}
function section(title, report, status) {
    const entries = report.outcomes.filter((outcome) => outcome.status === status);
    if (entries.length === 0)
        return;
    console.log(`\n${title} (${entries.length})`);
    for (const entry of entries) {
        const detail = status === 'failed' ? entry.error : entry.reasons.length > 0 ? entry.reasons.join(', ') : '';
        console.log(`  ${entry.label}${detail ? `  — ${detail}` : ''}`);
    }
}
main().catch((error) => {
    console.error('\nSetup failed:');
    console.error((0, errors_1.describeError)(error));
    process.exitCode = 1;
});
//# sourceMappingURL=setupServer.js.map