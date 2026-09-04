"use strict";
/**
 * The curated starting library, surfaced by `/resources`.
 *
 * Selection bias is deliberate: microstructure, statistics, risk and process.
 * Nothing here promises an edge — these are the foundations you build one on.
 * Add entries freely; the slash command choices are generated from this file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESOURCE_TOPICS = void 0;
exports.findTopic = findTopic;
exports.RESOURCE_TOPICS = [
    {
        key: 'microstructure',
        label: 'Market Microstructure & Order Flow',
        summary: 'How the market you are trading actually works underneath the chart.',
        entries: [
            {
                title: 'Trading and Exchanges: Market Microstructure for Practitioners',
                by: 'Larry Harris',
                note: 'The standard reference. Start here before any order flow content.',
            },
            {
                title: 'Market Microstructure Theory',
                by: 'Maureen O’Hara',
                note: 'The academic backbone: information, adverse selection, price formation.',
            },
            {
                title: 'Algorithmic and High-Frequency Trading',
                by: 'Cartea, Jaimungal & Penalva',
                note: 'Formal treatment of execution, market making and inventory risk.',
            },
            {
                title: 'CME Group — Education & Contract Specifications',
                note: 'Read the specs for anything you trade: hours, tick value, margin, settlement.',
                url: 'https://www.cmegroup.com/education.html',
            },
        ],
    },
    {
        key: 'statistics',
        label: 'Statistics, Probability & Evidence',
        summary: 'The difference between a result and a finding.',
        entries: [
            {
                title: 'Evidence-Based Technical Analysis',
                by: 'David Aronson',
                note: 'Data-mining bias, multiple testing, and how most "edges" evaporate.',
            },
            {
                title: 'Fooled by Randomness',
                by: 'Nassim Taleb',
                note: 'On survivorship, luck and mistaking a sample for a law.',
            },
            {
                title: 'The Elements of Statistical Learning',
                by: 'Hastie, Tibshirani & Friedman',
                note: 'Free PDF. Overfitting and validation, in the language of the field.',
                url: 'https://hastie.su.domains/ElemStatLearn/',
            },
            {
                title: 'Advances in Financial Machine Learning',
                by: 'Marcos López de Prado',
                note: 'Purged cross-validation, labelling, backtest overfitting. Demanding but essential.',
            },
        ],
    },
    {
        key: 'risk',
        label: 'Risk & Position Sizing',
        summary: 'Survival first. Expectancy is worthless if you are not there to collect it.',
        entries: [
            {
                title: 'Systematic Trading',
                by: 'Robert Carver',
                note: 'Position sizing, volatility targeting and portfolio construction, done properly.',
            },
            {
                title: 'Leveraged Trading',
                by: 'Robert Carver',
                note: 'The accessible version of the above. Read it if the first is too dense.',
            },
            {
                title: 'The Mathematics of Money Management',
                by: 'Ralph Vince',
                note: 'Optimal f, geometric growth, and why maximising it is usually a mistake.',
            },
            {
                title: 'A Man for All Markets',
                by: 'Edward Thorp',
                note: 'Kelly, edge and bankroll, from the person who brought them to markets.',
            },
        ],
    },
    {
        key: 'psychology',
        label: 'Psychology & Process',
        summary: 'Execution is a behavioural problem long before it is an analytical one.',
        entries: [
            {
                title: 'Thinking, Fast and Slow',
                by: 'Daniel Kahneman',
                note: 'The biases you will spend your career managing.',
            },
            {
                title: 'The Laws of Trading',
                by: 'Agustin Lebron',
                note: 'Decision-making under uncertainty from a professional trading seat.',
            },
            {
                title: 'Trading in the Zone',
                by: 'Mark Douglas',
                note: 'Dated in places, still the clearest statement of probabilistic mindset.',
            },
            {
                title: 'Keep a written journal',
                note: 'Thesis, invalidation and emotional state recorded *before* the outcome is known. No book substitutes for this.',
            },
        ],
    },
    {
        key: 'research',
        label: 'Research & Backtesting',
        summary: 'Turning an observation into a tested hypothesis.',
        entries: [
            {
                title: 'Quantitative Trading',
                by: 'Ernest Chan',
                note: 'A practical end-to-end research workflow for an individual.',
            },
            {
                title: 'Inside the Black Box',
                by: 'Rishi Narang',
                note: 'What systematic strategies are actually made of, without the mystique.',
            },
            {
                title: 'Python: pandas, NumPy, SciPy, statsmodels',
                note: 'The default research stack. Learn pandas properly — it pays for itself in weeks.',
                url: 'https://pandas.pydata.org/docs/',
            },
            {
                title: 'Quantpedia / SSRN / arXiv q-fin',
                note: 'Published strategies and papers. Read the methodology section, not the abstract.',
                url: 'https://arxiv.org/list/q-fin/recent',
            },
        ],
    },
    {
        key: 'data',
        label: 'Data & Reference',
        summary: 'Where the numbers come from.',
        entries: [
            {
                title: 'FRED — Federal Reserve Economic Data',
                note: 'Free macro series: rates, inflation, employment, spreads.',
                url: 'https://fred.stlouisfed.org/',
            },
            {
                title: 'SEC EDGAR',
                note: 'Primary filings. If you trade single names, read the source document.',
                url: 'https://www.sec.gov/edgar',
            },
            {
                title: 'CFTC Commitments of Traders',
                note: 'Weekly positioning data for futures markets.',
                url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
            },
            {
                title: 'Exchange calendars & session times',
                note: 'Know the holidays, the settlement times and the roll dates for what you trade.',
            },
        ],
    },
];
function findTopic(key) {
    return exports.RESOURCE_TOPICS.find((topic) => topic.key === key);
}
//# sourceMappingURL=resources.js.map