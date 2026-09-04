"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FUNDED_REQUEST_BUTTON = exports.FUNDED_ROLE_KEY = exports.SELF_ROLE_GROUPS = void 0;
exports.selfRoleDefinitions = selfRoleDefinitions;
exports.groupFor = groupFor;
exports.keysInGroup = keysInGroup;
/**
 * Order flow and volumetric platforms.
 *
 * Restricted to software that genuinely exists today and genuinely does
 * footprint / volume-profile / DOM analysis on real data. Deliberately
 * excluded: dead products, indicator packs sold as "software", and anything
 * that is a signal service wearing a chart.
 *
 * Discord allows at most 25 options in one select menu.
 */
const ORDER_FLOW_SOFTWARE = [
    { key: 'sw-sierra', label: 'Sierra Chart', description: 'Numbers bars, DOM, deep customisation' },
    { key: 'sw-bookmap', label: 'Bookmap', description: 'Liquidity heatmap and order book visualisation' },
    { key: 'sw-atas', label: 'ATAS', description: 'Footprint, cluster analysis, market profile' },
    { key: 'sw-quantower', label: 'Quantower', description: 'Multi-broker platform with volume analysis' },
    { key: 'sw-jigsaw', label: 'Jigsaw Daytradr', description: 'DOM-first execution and tape reading' },
    { key: 'sw-exocharts', label: 'Exocharts', description: 'Browser-based footprint, crypto and futures' },
    { key: 'sw-ninjatrader', label: 'NinjaTrader', description: 'With the Order Flow+ suite' },
    { key: 'sw-motivewave', label: 'MotiveWave', description: 'Order flow and Elliott Wave tooling' },
    { key: 'sw-investorrt', label: 'Investor/RT', description: 'Long-standing market profile platform' },
    { key: 'sw-volfix', label: 'VolFix', description: 'Cluster and volume analysis' },
    { key: 'sw-volumetrica', label: 'Volumetrica', description: 'Italian-built volumetric analysis platform' },
    { key: 'sw-overcharts', label: 'Overcharts', description: 'Footprint and volume profile for futures' },
    { key: 'sw-tt', label: 'Trading Technologies', description: 'Institutional execution and ADL' },
    { key: 'sw-cqg', label: 'CQG', description: 'Institutional data, DOM and analytics' },
    { key: 'sw-rithmic', label: 'Rithmic R|Trader Pro', description: 'Low-latency futures execution' },
    { key: 'sw-agenatrader', label: 'AgenaTrader', description: 'Multi-timeframe with volume tooling' },
    { key: 'sw-photon', label: 'Photon Trader', description: 'DOM and order flow execution' },
    { key: 'sw-tradovate', label: 'Tradovate', description: 'Cloud futures platform with DOM' },
    { key: 'sw-tradingview', label: 'TradingView', description: 'Charting, with volume profile on paid tiers' },
    { key: 'sw-other', label: 'Other / none yet', description: 'Something else, or still deciding' },
];
const REGION = [
    {
        key: 'region-international',
        label: 'International',
        description: 'You read and write in English',
    },
    {
        key: 'region-italian',
        label: 'Italiano',
        description: 'Accesso alla sezione italiana e ping in italiano',
    },
];
exports.SELF_ROLE_GROUPS = [
    {
        key: 'region',
        title: 'LANGUAGE',
        intro: 'Pick where you read. This is not access control — the Italian area is open to everyone — it just tells people which language you are comfortable in.',
        customId: 'desk:selfrole:region',
        minValues: 0,
        maxValues: 1,
        options: REGION,
    },
    {
        key: 'software',
        title: 'ORDER FLOW SOFTWARE',
        intro: 'What do you actually run? Pick as many as apply. It makes "how do I set this up" answerable by someone using the same tool.',
        customId: 'desk:selfrole:software',
        minValues: 0,
        maxValues: ORDER_FLOW_SOFTWARE.length,
        options: ORDER_FLOW_SOFTWARE,
    },
];
/** The role granted after a staff member verifies a funded account. */
exports.FUNDED_ROLE_KEY = 'funded-trader';
/** Component id for the "request verification" button in the roles channel. */
exports.FUNDED_REQUEST_BUTTON = 'desk:funded:request';
/** Every self-assignable role, as blueprint role definitions. */
function selfRoleDefinitions() {
    const fromGroups = exports.SELF_ROLE_GROUPS.flatMap((group) => group.options.map((option) => ({
        key: option.key,
        name: option.label,
        hoist: false,
        mentionable: false,
        permissions: [],
        purpose: `${group.title.toLowerCase()} — self-assigned`,
    })));
    return [
        ...fromGroups,
        {
            key: exports.FUNDED_ROLE_KEY,
            name: 'Funded',
            color: 0x4ea172,
            hoist: false,
            mentionable: false,
            permissions: [],
            purpose: 'Granted by staff after a funded account is verified. Never self-assigned.',
        },
    ];
}
function groupFor(customId) {
    return exports.SELF_ROLE_GROUPS.find((group) => group.customId === customId);
}
/** Every role key owned by a group — used to remove deselected roles. */
function keysInGroup(group) {
    return group.options.map((option) => option.key);
}
//# sourceMappingURL=selfRoles.js.map