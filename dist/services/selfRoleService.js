"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolePanels = rolePanels;
exports.handleSelfRoleSelect = handleSelfRoleSelect;
exports.handleFundedRequest = handleFundedRequest;
exports.decideFunded = decideFunded;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const server_1 = require("../config/server");
const selfRoles_1 = require("../config/selfRoles");
const errors_1 = require("../utils/errors");
const format_1 = require("../utils/format");
const logger_1 = require("./logger");
const resolve_1 = require("./resolve");
const state_1 = require("./state");
function rolePanels() {
    const panels = selfRoles_1.SELF_ROLE_GROUPS.map((group) => ({
        key: `roles:${group.key}`,
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(branding_1.COLORS.neutral)
                .setTitle(group.title)
                .setDescription(group.intro)
                .setFooter({ text: `${branding_1.BRAND.footer} · select to add, deselect to remove` }),
        ],
        components: [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(group.customId)
                .setPlaceholder(group.maxValues > 1 ? 'Pick as many as apply' : 'Pick one')
                .setMinValues(group.minValues)
                // Discord rejects maxValues above the option count.
                .setMaxValues(Math.min(group.maxValues, group.options.length))
                .addOptions(group.options.map((option) => new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel((0, format_1.truncate)(option.label, 100))
                .setDescription((0, format_1.truncate)(option.description, 100))
                .setValue(option.key)))),
        ],
    }));
    panels.push({
        key: 'roles:funded',
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(branding_1.COLORS.neutral)
                .setTitle('FUNDED TRADER')
                .setDescription([
                'This one is not self-served. A claim about trading firm capital is exactly the sort of thing that gets inflated, so a moderator checks it.',
                '',
                'Press the button and a **private thread** opens with the staff. Post **one** of:',
                '',
                '• A screenshot of your firm dashboard showing the account status and the firm name',
                '• A payout confirmation from the firm',
                '• The funded certificate the firm issued you',
                '',
                '**Redact everything else.** Cover the account number, your full name, your address, your balance and any payment details — none of that proves anything and all of it is worth stealing. The firm name and the account status is the whole check.',
                '',
                'Staff will never ask you for login credentials, an API key, or money. Anyone who does is not staff.',
            ].join('\n'))
                .setFooter({ text: `${branding_1.BRAND.footer} · reviewed by a human, not a bot` }),
        ],
        components: [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(selfRoles_1.FUNDED_REQUEST_BUTTON)
                .setLabel('Request funded verification')
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
        ],
    });
    return panels;
}
/** Apply a menu selection: the member's roles in that group match it exactly. */
async function handleSelfRoleSelect(interaction) {
    if (!interaction.inCachedGuild())
        return;
    const group = (0, selfRoles_1.groupFor)(interaction.customId);
    if (!group)
        return;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const chosen = new Set('values' in interaction ? interaction.values : []);
    const { added, removed, failed } = await applyGroup(member, group, chosen);
    if (failed.length > 0) {
        logger_1.logger.warn('MEMBER', `Could not apply ${failed.length} self-role(s) for ${member.user.tag} — missing role or hierarchy`);
    }
    const lines = [];
    if (added.length > 0)
        lines.push(`**Added:** ${added.join(', ')}`);
    if (removed.length > 0)
        lines.push(`**Removed:** ${removed.join(', ')}`);
    if (lines.length === 0)
        lines.push('Nothing changed.');
    if (failed.length > 0) {
        lines.push('', `Could not apply: ${failed.join(', ')}. A moderator has been notified.`);
    }
    await interaction.editReply(lines.join('\n'));
}
async function applyGroup(member, group, chosen) {
    const added = [];
    const removed = [];
    const failed = [];
    for (const key of (0, selfRoles_1.keysInGroup)(group)) {
        const role = (0, resolve_1.findRole)(member.guild, key);
        if (!role) {
            if (chosen.has(key))
                failed.push(key);
            continue;
        }
        const shouldHave = chosen.has(key);
        const hasIt = member.roles.cache.has(role.id);
        if (shouldHave === hasIt)
            continue;
        try {
            if (shouldHave) {
                await member.roles.add(role, 'Self-assigned role');
                added.push(role.name);
            }
            else {
                await member.roles.remove(role, 'Self-assigned role removed');
                removed.push(role.name);
            }
        }
        catch {
            failed.push(role.name);
        }
    }
    return { added, removed, failed };
}
/* ── Funded verification ───────────────────────────────────── */
async function handleFundedRequest(interaction) {
    if (!interaction.inCachedGuild())
        return;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const funded = (0, resolve_1.findRole)(guild, selfRoles_1.FUNDED_ROLE_KEY);
    if (funded && member.roles.cache.has(funded.id)) {
        await interaction.editReply('You are already verified as a funded trader.');
        return;
    }
    const pending = state_1.state.read().fundedRequests[member.id];
    if (pending) {
        await interaction.editReply(`You already have a verification open: <#${pending.threadId}>. Post your proof there.`);
        return;
    }
    const channel = (0, resolve_1.findTextChannel)(guild, server_1.SERVER.ticketChannelKey);
    if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
        throw new errors_1.OperationalError('The support channel is missing.', 'An admin should run `/setup` to restore it.');
    }
    // A private thread: the proof stays between the member and the staff, which
    // is the entire point given what is being posted.
    const thread = await channel.threads.create({
        name: (0, format_1.truncate)(`funded · ${member.displayName}`, 100),
        type: discord_js_1.ChannelType.PrivateThread,
        invitable: false,
        autoArchiveDuration: discord_js_1.ThreadAutoArchiveDuration.OneWeek,
        reason: `Funded verification requested by ${member.user.tag}`,
    });
    await thread.members.add(member.id).catch(() => undefined);
    const moderator = (0, resolve_1.findRole)(guild, 'moderator');
    await thread.send({
        ...(moderator ? { content: `<@&${moderator.id}>` } : {}),
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(branding_1.COLORS.primary)
                .setTitle('FUNDED VERIFICATION')
                .setDescription([
                `Requested by <@${member.id}>.`,
                '',
                '**Post one piece of proof:** a firm dashboard screenshot, a payout confirmation, or your funded certificate.',
                '',
                '**Redact before you post.** Cover the account number, your legal name, your address, your balance and anything to do with payments. The firm name and the account status is all that is being checked.',
                '',
                'A moderator will approve or decline with `/funded`.',
            ].join('\n'))
                .setFooter({ text: `${branding_1.BRAND.footer} · never share credentials or payment details` }),
        ],
        allowedMentions: moderator ? { roles: [moderator.id] } : { parse: [] },
    });
    state_1.state.update((current) => {
        current.fundedRequests[member.id] = {
            threadId: thread.id,
            requestedAt: new Date().toISOString(),
        };
    });
    logger_1.logger.info('MEMBER', `Funded verification requested by ${member.user.tag}`);
    await interaction.editReply(`Verification opened: <#${thread.id}>`);
}
/** Staff decision. Called by /funded. */
async function decideFunded(guild, target, approve, moderatorTag) {
    const role = (0, resolve_1.findRole)(guild, selfRoles_1.FUNDED_ROLE_KEY);
    if (!role) {
        throw new errors_1.OperationalError('The Funded role does not exist.', 'Run `/setup` to create it, then try again.');
    }
    if (approve) {
        await target.roles.add(role, `Funded account verified by ${moderatorTag}`);
    }
    else if (target.roles.cache.has(role.id)) {
        await target.roles.remove(role, `Funded verification revoked by ${moderatorTag}`);
    }
    state_1.state.update((current) => {
        delete current.fundedRequests[target.id];
    });
    logger_1.logger.info('MEMBER', `Funded verification ${approve ? 'approved' : 'declined'} for ${target.user.tag} by ${moderatorTag}`);
    return approve
        ? `**${target.user.tag}** is now verified as a funded trader.`
        : `Declined. **${target.user.tag}** was not given the Funded role.`;
}
//# sourceMappingURL=selfRoleService.js.map