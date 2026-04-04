import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BOTS } from '../data/bots';
import { getBotSnapshot, getCurrentRank, buildTransactions, buildVaultActivity, formatUsd, formatSignedUsd, formatSignedPct, formatPct, shortHash } from '../data/helpers';

export function BotDetailPage() {
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
            <Link className="cta-button" to="/leaderboard">Back to Leaderboard</Link>
          </div>
        </section>
      </main>
    );
  }

  const chartPoints = bot.equityCurve.map((value, index) => `${index * 45},${140 - value}`).join(' ');

  return (
    <main className="content">
      <section className="hero">
        <p className="eyebrow">Bot Detail</p>
        <div className="bot-detail-heading">
          <span className="agent-avatar agent-avatar-large" aria-hidden="true">{bot.avatar}</span>
          <div><h1>{bot.name}</h1></div>
        </div>
        <p className="subtitle">{bot.strategyDescription}</p>
      </section>

      <section className="section-block" aria-labelledby="bot-header-title">
        <div className="section-head">
          <div>
            <h2 id="bot-header-title">Header bot</h2>
            <p className="section-subtitle">Owner / creator: {bot.owner}</p>
          </div>
          <Link className="cta-button cta-button-small" to="/leaderboard">Back to leaderboard</Link>
        </div>
        <div className="stats-grid">
          <article className="metric-card"><p className="metric-label">Current rank</p><p className="metric-value">#{rank}</p></article>
          <article className="metric-card"><p className="metric-label">Vault value</p><p className="metric-value">{formatUsd(summary.vaultValue)}</p></article>
          <article className="metric-card"><p className="metric-label">Total PnL</p><p className={`metric-value ${summary.pnl >= 0 ? 'profit-cell' : 'loss-cell'}`}>{formatSignedUsd(summary.pnl)}</p></article>
          <article className="metric-card"><p className="metric-label">ROI</p><p className={`metric-value ${summary.roi >= 0 ? 'profit-cell' : 'loss-cell'}`}>{formatSignedPct(summary.roi)}</p></article>
          <article className="metric-card"><p className="metric-label">Fees</p><p className="metric-value metric-value-small">{bot.fees}</p></article>
        </div>
      </section>

      <section className="section-block" aria-labelledby="performance-title">
        <h2 id="performance-title">Performance summary</h2>
        <div className="stats-grid">
          <article className="metric-card"><p className="metric-label">ROI</p><p className="metric-value profit-cell">{formatSignedPct(summary.roi)}</p></article>
          <article className="metric-card"><p className="metric-label">Win rate</p><p className="metric-value">{formatPct(summary.winRate)}</p></article>
          <article className="metric-card"><p className="metric-label">Max drawdown</p><p className="metric-value loss-cell">{formatSignedPct(bot.maxDrawdown)}</p></article>
          <article className="metric-card"><p className="metric-label">Number of trades</p><p className="metric-value">{summary.trades}</p></article>
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
              <tr><th>Date / time</th><th>Pair / asset</th><th>Buy / sell</th><th>Size</th><th>Entry / exit</th><th>Gain or loss</th><th>Tx hash</th><th>Etherscan link</th></tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.dateTime} UTC</td>
                  <td>{tx.pair}</td>
                  <td>{tx.side}</td>
                  <td>{formatUsd(tx.size)}</td>
                  <td>{formatUsd(tx.entry)} / {formatUsd(tx.exit)}</td>
                  <td className={tx.pnl >= 0 ? 'profit-cell' : 'loss-cell'}>{formatSignedUsd(tx.pnl)}</td>
                  <td>{shortHash(tx.txHash)}</td>
                  <td><a href={tx.etherscanUrl} target="_blank" rel="noreferrer">View on Etherscan</a></td>
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
                <li key={item.id}><span>{item.date}</span><span>{item.from}</span><span className="profit-cell">{formatSignedUsd(item.amount)}</span></li>
              ))}
            </ul>
          </article>
          <article>
            <p className="metric-label">Withdrawals</p>
            <ul className="vault-list">
              {vault.withdrawals.map((item) => (
                <li key={item.id}><span>{item.date}</span><span>{item.to}</span><span className="loss-cell">{formatSignedUsd(-item.amount)}</span></li>
              ))}
            </ul>
          </article>
          <article>
            <p className="metric-label">External backers</p>
            <ul className="vault-list">
              {vault.backers.map((backer) => <li key={backer}>{backer}</li>)}
            </ul>
          </article>
        </div>
        <div className="cta-row">
          <button type="button" className="cta-button">Fund this bot</button>
          <button type="button" className="cta-button cta-button-secondary">View vault</button>
        </div>
      </section>
    </main>
  );
}