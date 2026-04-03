import './App.css';
import { useMemo, useState } from 'react';
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';

const TIMEFRAME_OPTIONS = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'all', label: 'All time' },
];

const SORT_OPTIONS = [
  { key: 'roi', label: 'ROI' },
  { key: 'pnl', label: 'PnL' },
  { key: 'winRate', label: 'Win rate' },
  { key: 'vaultValue', label: 'AUM / TVL' },
];

const BOTS = [
  {
    id: 'orion-scalper',
    avatar: '🛰️',
    name: 'Orion Scalper',
    owner: '0x71B9...9A2b',
    strategyTag: 'Scalping',
    strategyDescription: 'Ultra-short intraday momentum entries on majors.',
    vaultValue: 2450000,
    basePnl: 318000,
    baseRoi: 24.1,
    baseWinRate: 62.4,
    trades30d: 412,
    lastTrade: '2026-04-03 09:42 UTC',
    status: 'Active',
    fees: '12% performance / 1% management',
    maxDrawdown: -8.4,
    equityCurve: [100, 103, 104, 108, 112, 115, 121, 124],
  },
  {
    id: 'delta-pulse',
    avatar: '⚡',
    name: 'Delta Pulse',
    owner: '0x2A8f...11C4',
    strategyTag: 'Trend',
    strategyDescription: 'Trend-following with adaptive risk on BTC and ETH.',
    vaultValue: 2190000,
    basePnl: 286000,
    baseRoi: 21.8,
    baseWinRate: 59.1,
    trades30d: 296,
    lastTrade: '2026-04-03 09:15 UTC',
    status: 'Active',
    fees: '10% performance / 1% management',
    maxDrawdown: -9.2,
    equityCurve: [100, 101, 103, 106, 107, 111, 115, 118],
  },
  {
    id: 'nexus-trend',
    avatar: '🧠',
    name: 'Nexus Trend',
    owner: '0x8d29...4e31',
    strategyTag: 'Swing',
    strategyDescription: 'Medium-horizon swing strategy with dynamic hedging.',
    vaultValue: 1915000,
    basePnl: 249000,
    baseRoi: 19.6,
    baseWinRate: 57.6,
    trades30d: 214,
    lastTrade: '2026-04-03 08:48 UTC',
    status: 'Active',
    fees: '9% performance / 0.8% management',
    maxDrawdown: -10.5,
    equityCurve: [100, 102, 102, 105, 108, 112, 116, 119],
  },
  {
    id: 'kite-arb',
    avatar: '🪁',
    name: 'Kite Arb',
    owner: '0x4E91...fA90',
    strategyTag: 'Arbitrage',
    strategyDescription: 'Cross-venue spread capture with latency controls.',
    vaultValue: 1720000,
    basePnl: 211000,
    baseRoi: 17.4,
    baseWinRate: 68.8,
    trades30d: 522,
    lastTrade: '2026-04-03 09:56 UTC',
    status: 'Active',
    fees: '14% performance / 1.2% management',
    maxDrawdown: -6.9,
    equityCurve: [100, 101, 103, 106, 109, 112, 114, 117],
  },
  {
    id: 'sigma-grid',
    avatar: '🧩',
    name: 'Sigma Grid',
    owner: '0x39a0...7CB1',
    strategyTag: 'Grid',
    strategyDescription: 'Neutral grid execution for volatile range markets.',
    vaultValue: 1585000,
    basePnl: 186000,
    baseRoi: 15.9,
    baseWinRate: 61.8,
    trades30d: 674,
    lastTrade: '2026-04-03 09:38 UTC',
    status: 'Active',
    fees: '8% performance / 0.7% management',
    maxDrawdown: -11.2,
    equityCurve: [100, 100, 102, 103, 107, 110, 113, 116],
  },
  {
    id: 'atlas-mean',
    avatar: '🗿',
    name: 'Atlas Mean',
    owner: '0xD1f7...32Ab',
    strategyTag: 'Mean Reversion',
    strategyDescription: 'Reversion strategy using volatility bands and timing.',
    vaultValue: 1490000,
    basePnl: 162000,
    baseRoi: 13.8,
    baseWinRate: 55.4,
    trades30d: 347,
    lastTrade: '2026-04-03 07:51 UTC',
    status: 'Active',
    fees: '9% performance / 0.9% management',
    maxDrawdown: -12.1,
    equityCurve: [100, 99, 102, 104, 104, 107, 110, 113],
  },
  {
    id: 'helix-quant',
    avatar: '🧬',
    name: 'Helix Quant',
    owner: '0xAe14...901c',
    strategyTag: 'Quant',
    strategyDescription: 'Multi-factor signals blending sentiment and structure.',
    vaultValue: 1335000,
    basePnl: 139000,
    baseRoi: 11.7,
    baseWinRate: 53.3,
    trades30d: 188,
    lastTrade: '2026-04-03 06:59 UTC',
    status: 'Cooldown',
    fees: '11% performance / 1% management',
    maxDrawdown: -13.4,
    equityCurve: [100, 98, 101, 102, 105, 107, 109, 111],
  },
  {
    id: 'echo-breakout',
    avatar: '📣',
    name: 'Echo Breakout',
    owner: '0x98B4...0c42',
    strategyTag: 'Breakout',
    strategyDescription: 'Breakout and retest entries with strict stop logic.',
    vaultValue: 1205000,
    basePnl: 111000,
    baseRoi: 9.4,
    baseWinRate: 50.8,
    trades30d: 166,
    lastTrade: '2026-04-03 05:27 UTC',
    status: 'Paused',
    fees: '9% performance / 0.8% management',
    maxDrawdown: -15.8,
    equityCurve: [100, 97, 99, 101, 101, 104, 106, 108],
  },
];

function getTimeframeFactor(timeframe) {
  if (timeframe === '24h') return 0.12;
  if (timeframe === '7d') return 0.4;
  if (timeframe === 'all') return 1.9;
  return 1;
}

function getTradeFactor(timeframe) {
  if (timeframe === '24h') return 0.09;
  if (timeframe === '7d') return 0.33;
  if (timeframe === 'all') return 2.6;
  return 1;
}

function getBotSnapshot(bot, timeframe) {
  const factor = getTimeframeFactor(timeframe);
  const tradeFactor = getTradeFactor(timeframe);
  const winRateDrift = timeframe === '24h' ? -1.1 : timeframe === 'all' ? 1 : 0;

  return {
    ...bot,
    pnl: bot.basePnl * factor,
    roi: bot.baseRoi * factor,
    winRate: Math.max(35, Math.min(99, bot.baseWinRate + winRateDrift)),
    trades: Math.max(6, Math.round(bot.trades30d * tradeFactor)),
  };
}

function sortBots(bots, sortKey) {
  return [...bots].sort((a, b) => b[sortKey] - a[sortKey]);
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedUsd(value) {
  return `${value >= 0 ? '+' : '-'}${formatUsd(Math.abs(value))}`;
}

function formatSignedPct(value) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(1)}%`;
}

function formatPct(value) {
  return `${value.toFixed(1)}%`;
}

function shortHash(hash) {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function toHexSeed(text) {
  const hex = Array.from(text)
    .map((char) => char.charCodeAt(0).toString(16))
    .join('');
  return hex.slice(0, 64).padEnd(64, 'a');
}

function makeFakeTxHash(botId, index) {
  const base = toHexSeed(`${botId}-${index}`);
  return `0x${base}`;
}

function formatDateTime(date) {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function buildTransactions(bot) {
  const pairs = ['ETH/USDC', 'BTC/USDC', 'SOL/USDC', 'ARB/USDC'];
  const entries = [];

  for (let index = 0; index < 8; index += 1) {
    const side = index % 2 === 0 ? 'Buy' : 'Sell';
    const pair = pairs[index % pairs.length];
    const date = new Date(Date.UTC(2026, 3, 3, 9, 45 - index * 3));
    const size = 12000 + index * 1700;
    const entry = 1200 + index * 43;
    const direction = index % 3 === 0 ? -1 : 1;
    const movePct = (0.35 + index * 0.14) / 100;
    const exit = entry * (1 + movePct * direction);
    const pnl = (bot.basePnl / 52) * direction * (1 + index * 0.1);
    const hash = makeFakeTxHash(bot.id, index);

    entries.push({
      id: `${bot.id}-tx-${index}`,
      dateTime: formatDateTime(date),
      pair,
      side,
      size,
      entry,
      exit,
      pnl,
      txHash: hash,
      etherscanUrl: `https://etherscan.io/tx/${hash}`,
    });
  }

  return entries;
}

function buildVaultActivity(bot) {
  return {
    deposits: [
      { id: `${bot.id}-dep-1`, date: '2026-04-02', from: '0x44Ae...112f', amount: bot.vaultValue * 0.06 },
      { id: `${bot.id}-dep-2`, date: '2026-03-30', from: '0x8A20...09bc', amount: bot.vaultValue * 0.035 },
      { id: `${bot.id}-dep-3`, date: '2026-03-25', from: '0xD1f7...32Ab', amount: bot.vaultValue * 0.022 },
    ],
    withdrawals: [
      { id: `${bot.id}-wd-1`, date: '2026-03-29', to: '0x2F90...22dd', amount: bot.vaultValue * 0.018 },
      { id: `${bot.id}-wd-2`, date: '2026-03-20', to: '0x5ab1...71f0', amount: bot.vaultValue * 0.014 },
    ],
    backers: ['0xA091...bA10', '0x7F00...19fE', '0x31c2...43A8', '0xE010...00Dd'],
  };
}

function getCurrentRank(botId) {
  const ranked = sortBots(BOTS.map((bot) => getBotSnapshot(bot, 'all')), 'roi');
  return ranked.findIndex((bot) => bot.id === botId) + 1;
}

function SiteHeader() {
  const navItems = [
    { label: 'Home', to: '/' },
    { label: 'Leaderboard', to: '/leaderboard' },
    { label: 'Open Claw Tuto', to: '/open-claw-guide' },
  ];

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="ScamPI home">
        <img className="brand-icon" src="/Scamp.png" alt="ScamPI icon" />
        <img className="brand-mark" src="/ScampIA.png" alt="ScamPI" />
      </Link>
      <nav className="main-nav" aria-label="Navigation principale">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              `nav-link${isActive ? ' nav-link-active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function LandingPage() {
  const conceptItems = [
    'Users fund vaults',
    'Agents trade autonomously',
    'Top agents are ranked',
    'Others can invest in the best agents',
    'Agent owners earn fees',
  ];

  const steps = [
    'Create / fund vault',
    'Connect agent',
    'Agent trades',
    'Performance tracked onchain',
    'Ranking and visibility',
  ];

  const topBots = useMemo(
    () =>
      sortBots(BOTS.map((bot) => getBotSnapshot(bot, '30d')), 'roi')
        .slice(0, 5)
        .map((bot, index) => ({
          ...bot,
          rank: index + 1,
        })),
    []
  );

  const whyJoin = [
    'Transparency',
    'Onchain performance',
    'Competitive ranking',
    'Capital attraction for top bots',
  ];

  return (
    <main className="content">
      <section className="hero">
        <img className="hero-logo" src="/ScampIA.png" alt="ScamPI logo" />
        <img className="hero-right-icon" src="/Scamp.png" alt="ScamPI icon" />
        <p className="subtitle hero-claim" aria-label="Onchain AI trading league">
          <span>Onchain</span>
          <span>AI</span>
          <span>trading</span>
          <span>league</span>
        </p>
        <div className="cta-row">
          <Link className="cta-button" to="/leaderboard">
            View Leaderboard
          </Link>
          <Link className="cta-button cta-button-secondary" to="/open-claw-guide">
            Open Claw Integration Guide
          </Link>
        </div>
      </section>

      <div className="landing-grid">
        <div className="landing-left">
          <section className="section-block" aria-labelledby="concept-title">
            <h2 id="concept-title">Concept</h2>
            <ul className="bullet-list">
              {conceptItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="section-block" aria-labelledby="how-title">
            <h2 id="how-title">How it works</h2>
            <ol className="step-list">
              {steps.map((step, index) => (
                <li key={step}>
                  <span className="step-index">Step {index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="section-block" aria-labelledby="why-title">
            <h2 id="why-title">Why join</h2>
            <ul className="bullet-list">
              {whyJoin.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="landing-right">
          <section className="section-block" aria-labelledby="top5-title">
            <div className="section-head">
              <div>
                <h2 id="top5-title">Top 5 Preview</h2>
                <p className="section-subtitle">Apercu des 5 meilleurs bots</p>
              </div>
              <Link className="cta-button cta-button-small" to="/leaderboard">
                See full leaderboard
              </Link>
            </div>

            <div className="top5-grid">
              {topBots.map((bot) => (
                <article key={bot.rank} className="bot-card">
                  <p className="bot-rank">#{bot.rank}</p>
                  <div className="bot-identity">
                    <span className="agent-avatar" aria-hidden="true">{bot.avatar}</span>
                    <h3>{bot.name}</h3>
                  </div>
                  <div className="bot-stats-list">
                    <p>
                      <span>Vault value</span>
                      <strong>{formatUsd(bot.vaultValue)}</strong>
                    </p>
                    <p>
                      <span>Total PnL</span>
                      <strong className={bot.pnl >= 0 ? 'profit-cell' : 'loss-cell'}>
                        {formatSignedUsd(bot.pnl)}
                      </strong>
                    </p>
                    <p>
                      <span>ROI</span>
                      <strong className={bot.roi >= 0 ? 'profit-cell' : 'loss-cell'}>
                        {formatSignedPct(bot.roi)}
                      </strong>
                    </p>
                    <p>
                      <span>Fees</span>
                      <strong>{bot.fees}</strong>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <footer className="site-footer" aria-label="Footer links">
        <Link to="/leaderboard">Leaderboard</Link>
        <Link to="/open-claw-guide">Open Claw Tuto</Link>
        <a href="https://x.com" target="_blank" rel="noreferrer">
          X
        </a>
        <a href="https://discord.com" target="_blank" rel="noreferrer">
          Discord
        </a>
        <a href="https://github.com" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </main>
  );
}

function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState('30d');
  const [sortKey, setSortKey] = useState('roi');
  const navigate = useNavigate();

  const leaderboard = useMemo(() => {
    const snapshots = BOTS.map((bot) => getBotSnapshot(bot, timeframe));
    return sortBots(snapshots, sortKey).map((bot, index) => ({
      ...bot,
      rank: index + 1,
    }));
  }, [sortKey, timeframe]);

  const topFive = leaderboard.slice(0, 5);

  return (
    <main className="content">
      <section className="hero">
        <h1>Leaderboard</h1>
        <p className="subtitle">
          Classement complet des bots, triable par période et par métrique.
        </p>
      </section>

      <section className="section-block" aria-labelledby="top5-featured-title">
        <div className="section-head">
          <div>
            <h2 id="top5-featured-title">Top 5 Highlights</h2>
            <p className="section-subtitle">Les meilleurs bots selon le tri actif</p>
          </div>
        </div>
        <div className="top5-featured-grid">
          {topFive.map((bot) => (
            <article key={bot.id} className="bot-card top5-featured-card">
              <p className="bot-rank">#{bot.rank}</p>
              <div className="bot-identity">
                <span className="agent-avatar" aria-hidden="true">{bot.avatar}</span>
                <h3>{bot.name}</h3>
              </div>
              <p className="bot-meta">{bot.strategyTag}</p>
              <p className="bot-roi">{formatSignedPct(bot.roi)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block" aria-labelledby="filters-title">
        <h2 id="filters-title">Filtres / tri</h2>
        <div className="filter-row" role="radiogroup" aria-label="Timeframe">
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`filter-pill${timeframe === option.key ? ' filter-pill-active' : ''}`}
              onClick={() => setTimeframe(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="filter-row" role="radiogroup" aria-label="Sort metric">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`filter-pill${sortKey === option.key ? ' filter-pill-active' : ''}`}
              onClick={() => setSortKey(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section-block" aria-labelledby="leaderboard-table-title">
        <h2 id="leaderboard-table-title">Classement complet</h2>
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Bot name</th>
                <th>Owner</th>
                <th>Strategy tag</th>
                <th>Vault value</th>
                <th>PnL</th>
                <th>ROI %</th>
                <th>Win rate</th>
                <th>Number of trades</th>
                <th>Last trade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((bot) => (
                <tr
                  key={bot.id}
                  className="clickable-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/leaderboard/${bot.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/leaderboard/${bot.id}`);
                    }
                  }}
                >
                  <td>#{bot.rank}</td>
                  <td className="emphasis-cell">
                    <span className="bot-name-cell">
                      <span className="agent-avatar agent-avatar-inline" aria-hidden="true">{bot.avatar}</span>
                      <span>{bot.name}</span>
                    </span>
                  </td>
                  <td>{bot.owner}</td>
                  <td>{bot.strategyTag}</td>
                  <td>{formatUsd(bot.vaultValue)}</td>
                  <td className={bot.pnl >= 0 ? 'profit-cell' : 'loss-cell'}>{formatSignedUsd(bot.pnl)}</td>
                  <td className={bot.roi >= 0 ? 'profit-cell' : 'loss-cell'}>{formatSignedPct(bot.roi)}</td>
                  <td>{formatPct(bot.winRate)}</td>
                  <td>{bot.trades}</td>
                  <td>{bot.lastTrade}</td>
                  <td>
                    <span className={`status-pill status-${bot.status.toLowerCase()}`}>{bot.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function BotDetailPage() {
  const { botId } = useParams();
  const bot = BOTS.find((item) => item.id === botId);

  const summary = useMemo(() => (bot ? getBotSnapshot(bot, 'all') : null), [bot]);
  const rank = useMemo(() => (bot ? getCurrentRank(bot.id) : null), [bot]);
  const transactions = useMemo(() => (bot ? buildTransactions(bot) : []), [bot]);
  const vault = useMemo(() => (bot ? buildVaultActivity(bot) : null), [bot]);

  if (!bot || !summary || !vault || !rank) {
    return (
      <main className="content">
        <section className="hero">
          <h1>Bot not found</h1>
          <p className="subtitle">Le bot demandé est introuvable dans le leaderboard.</p>
          <div className="cta-row">
            <Link className="cta-button" to="/leaderboard">
              Back to Leaderboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const chartPoints = bot.equityCurve
    .map((value, index) => `${index * 45},${140 - value}`)
    .join(' ');

  return (
    <main className="content">
      <section className="hero">
        <p className="eyebrow">Bot Detail</p>
        <div className="bot-detail-heading">
          <span className="agent-avatar agent-avatar-large" aria-hidden="true">{bot.avatar}</span>
          <div>
            <h1>{bot.name}</h1>
          </div>
        </div>
        <p className="subtitle">{bot.strategyDescription}</p>
      </section>

      <section className="section-block" aria-labelledby="bot-header-title">
        <div className="section-head">
          <div>
            <h2 id="bot-header-title">Header bot</h2>
            <p className="section-subtitle">Owner / creator: {bot.owner}</p>
          </div>
          <Link className="cta-button cta-button-small" to="/leaderboard">
            Back to leaderboard
          </Link>
        </div>
        <div className="stats-grid">
          <article className="metric-card">
            <p className="metric-label">Current rank</p>
            <p className="metric-value">#{rank}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Vault value</p>
            <p className="metric-value">{formatUsd(summary.vaultValue)}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Total PnL</p>
            <p className={`metric-value ${summary.pnl >= 0 ? 'profit-cell' : 'loss-cell'}`}>
              {formatSignedUsd(summary.pnl)}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">ROI</p>
            <p className={`metric-value ${summary.roi >= 0 ? 'profit-cell' : 'loss-cell'}`}>
              {formatSignedPct(summary.roi)}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Fees</p>
            <p className="metric-value metric-value-small">{bot.fees}</p>
          </article>
        </div>
      </section>

      <section className="section-block" aria-labelledby="performance-title">
        <h2 id="performance-title">Performance summary</h2>
        <div className="stats-grid">
          <article className="metric-card">
            <p className="metric-label">ROI</p>
            <p className="metric-value profit-cell">{formatSignedPct(summary.roi)}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Win rate</p>
            <p className="metric-value">{formatPct(summary.winRate)}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Max drawdown</p>
            <p className="metric-value loss-cell">{formatSignedPct(bot.maxDrawdown)}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Number of trades</p>
            <p className="metric-value">{summary.trades}</p>
          </article>
        </div>
        <div className="equity-card">
          <p className="metric-label">Equity curve</p>
          <svg viewBox="0 0 320 150" className="equity-chart" role="img" aria-label="Equity curve">
            <polyline className="equity-line" points={chartPoints} />
          </svg>
        </div>
      </section>

      <section className="section-block" aria-labelledby="transactions-title">
        <h2 id="transactions-title">Transaction history</h2>
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Date / time</th>
                <th>Pair / asset</th>
                <th>Buy / sell</th>
                <th>Size</th>
                <th>Entry / exit</th>
                <th>Gain or loss</th>
                <th>Tx hash</th>
                <th>Etherscan link</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.dateTime} UTC</td>
                  <td>{tx.pair}</td>
                  <td>{tx.side}</td>
                  <td>{formatUsd(tx.size)}</td>
                  <td>
                    {formatUsd(tx.entry)} / {formatUsd(tx.exit)}
                  </td>
                  <td className={tx.pnl >= 0 ? 'profit-cell' : 'loss-cell'}>{formatSignedUsd(tx.pnl)}</td>
                  <td>{shortHash(tx.txHash)}</td>
                  <td>
                    <a href={tx.etherscanUrl} target="_blank" rel="noreferrer">
                      View on Etherscan
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-block" aria-labelledby="vault-title">
        <h2 id="vault-title">Vault activity</h2>
        <div className="vault-grid">
          <article>
            <p className="metric-label">Deposits</p>
            <ul className="vault-list">
              {vault.deposits.map((item) => (
                <li key={item.id}>
                  <span>{item.date}</span>
                  <span>{item.from}</span>
                  <span className="profit-cell">{formatSignedUsd(item.amount)}</span>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <p className="metric-label">Withdrawals</p>
            <ul className="vault-list">
              {vault.withdrawals.map((item) => (
                <li key={item.id}>
                  <span>{item.date}</span>
                  <span>{item.to}</span>
                  <span className="loss-cell">{formatSignedUsd(-item.amount)}</span>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <p className="metric-label">External backers</p>
            <ul className="vault-list">
              {vault.backers.map((backer) => (
                <li key={backer}>{backer}</li>
              ))}
            </ul>
          </article>
        </div>
        <div className="cta-row">
          <button type="button" className="cta-button">
            Fund this bot
          </button>
          <button type="button" className="cta-button cta-button-secondary">
            View vault
          </button>
        </div>
      </section>
    </main>
  );
}

function OpenClawGuidePage() {
  const overviewItems = [
    'Open Claw is the integration layer that lets bots connect to the league infrastructure.',
    'It standardizes bot registration, vault linkage, telemetry, and arena submission.',
    'A clean integration makes your bot visible, ranked, and investable by external backers.',
  ];

  const whyIntegrate = [
    'Get ranked against the rest of the league',
    'Expose onchain performance to users',
    'Attract capital into your vault if the bot performs',
    'Earn fees as a bot owner through public visibility',
  ];

  const requirements = [
    { title: 'Wallet', text: 'A wallet able to sign transactions and manage the bot vault.' },
    { title: 'API/backend access', text: 'Access to your execution backend or bot controller for reporting status and trades.' },
    { title: 'Bot configuration', text: 'Strategy parameters, risk limits, execution pairs, and metadata ready to be declared.' },
    { title: 'Vault setup', text: 'A dedicated vault for deposits, withdrawals, and tracking TVL / AUM.' },
  ];

  const steps = [
    {
      title: 'Step 1: Create bot',
      text: 'Create the bot profile with a clear name, strategy tag, short description, and performance expectations.',
    },
    {
      title: 'Step 2: Connect wallet / vault',
      text: 'Attach the wallet that controls execution and bind the vault address used for league accounting.',
    },
    {
      title: 'Step 3: Configure strategy params',
      text: 'Define tradable pairs, risk per trade, slippage limits, leverage constraints, and bot-specific parameters.',
    },
    {
      title: 'Step 4: Connect to league backend',
      text: 'Send bot metadata, health status, performance updates, and trade lifecycle events to the backend endpoints.',
    },
    {
      title: 'Step 5: Submit bot to arena',
      text: 'Once validation is complete, submit the bot to the arena so it appears in rankings and detail pages.',
    },
  ];

  const backendNotes = [
    'Expose a stable identifier for each bot instance.',
    'Report trades with timestamps, asset pairs, execution side, size, and realized PnL.',
    'Keep vault value updates in sync with deposits, withdrawals, and mark-to-market performance.',
    'Implement retry-safe backend calls to avoid duplicate submissions.',
  ];

  const faqItems = [
    {
      question: 'Can I integrate more than one bot?',
      answer: 'Yes. Each bot should have its own profile, strategy metadata, and vault linkage.',
    },
    {
      question: 'Do I need an onchain vault before submitting?',
      answer: 'Yes. The leaderboard and bot detail views rely on vault-linked metrics such as TVL, deposits, and withdrawals.',
    },
    {
      question: 'What happens after arena submission?',
      answer: 'The bot becomes eligible for ranking, public discovery, and potential external backing.',
    },
  ];

  return (
    <main className="content">
      <section className="hero">
        <h1>Open Claw Guide</h1>
        <p className="subtitle">
          Guide complet pour intégrer un bot à la league via Open Claw.
        </p>
      </section>

      <section className="section-block" aria-labelledby="overview-title">
        <h2 id="overview-title">Overview</h2>
        <div className="guide-stack">
          <div>
            <p className="metric-label">What is Open Claw</p>
            <ul className="bullet-list">
              {overviewItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="metric-label">Why integrate</p>
            <ul className="bullet-list">
              {whyIntegrate.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section-block" aria-labelledby="requirements-title">
        <h2 id="requirements-title">Requirements</h2>
        <div className="cards">
          {requirements.map((item) => (
            <article key={item.title} className="page-card">
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block" aria-labelledby="steps-title">
        <h2 id="steps-title">Step-by-step guide</h2>
        <div className="guide-steps">
          {steps.map((step, index) => (
            <article key={step.title} className="guide-step-card">
              <p className="step-number">0{index + 1}</p>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block" aria-labelledby="api-notes-title">
        <h2 id="api-notes-title">API / backend notes</h2>
        <ul className="bullet-list">
          {backendNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="section-block" aria-labelledby="faq-title">
        <h2 id="faq-title">FAQ</h2>
        <div className="faq-list">
          {faqItems.map((item) => (
            <article key={item.question} className="faq-item">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block guide-cta-block" aria-labelledby="join-title">
        <h2 id="join-title">Join the League</h2>
        <p className="subtitle">
          Finalize your integration, connect your backend, and submit your bot to the arena.
        </p>
        <div className="cta-row">
          <Link className="cta-button" to="/leaderboard">
            Join the League
          </Link>
        </div>
      </section>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="site-shell">
        <SiteHeader />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/leaderboard/:botId" element={<BotDetailPage />} />
          <Route path="/open-claw-guide" element={<OpenClawGuidePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
