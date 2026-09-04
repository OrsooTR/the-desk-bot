"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsCommand = void 0;
const discord_js_1 = require("discord.js");
const news_1 = require("../../services/news");
/**
 * /news — post the digest now.
 *
 * The scheduler handles the daily run; this exists for testing a feed change
 * and for the morning the bot was restarting at 06:30.
 */
exports.newsCommand = {
    access: 'mentor',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('news')
        .setDescription('Post the market digest now. Mentor+.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    async execute({ interaction, guild }) {
        const url = await (0, news_1.postDigest)(guild);
        await interaction.editReply(url ? `Digest posted: ${url}` : 'The news channel is missing. Run `/setup`.');
    },
};
//# sourceMappingURL=news.js.map