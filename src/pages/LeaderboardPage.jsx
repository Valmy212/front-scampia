import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BOTS, TIMEFRAME_OPTIONS, SORT_OPTIONS } from '../data/bots';
import { getBotSnapshot, sortBots, formatUsd, formatSignedUsd, formatSignedPct, formatPct } from '../data/helpers';

export function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState('30d');
  const [sortKey, setSortKey] = useState('roi');
  const navigate = useNavigate();

  const leaderboard = useMemo(() => {
    const snapshots = BOTS.map((bot) => getBotSnapshot(bot, timeframe));
    return sortBots(snapshots, sortKey).map((bot, index) => ({ ...bot, rank: index + 1 }));
  }, [sortKey, timeframe]);

  const topFive = leaderboard.slice(0, 5);

  return (
    <main className="content">
      <section className="hero">
        <h1>Leaderboard</h1>
        <p className="subtitle">Classement complet des bots, triable par période et par métrique.</p>
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
        <div className="filter-line filter-line-single" aria-label="Leaderboard filters">
          <span className="filter-group-label">Period</span>
          {TIMEFRAME_OPTIONS.map((option) => (
            <button key={option.key} type="button" className={`filter-pill${timeframe === option.key ? ' filter-pill-active' : ''}`} onClick={() => setTimeframe(option.key)}>{option.label}</button>
          ))}
          <span className="filter-group-label">Sort</span>
          {SORT_OPTIONS.map((option) => (
            <button key={option.key} type="button" className={`filter-pill${sortKey === option.key ? ' filter-pill-active' : ''}`} onClick={() => setSortKey(option.key)}>{option.label}</button>
          ))}
        </div>
      </section>

      <section className="section-block" aria-labelledby="leaderboard-table-title">
        <h2 id="leaderboard-table-title">Classement complet</h2>
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th><th>Bot name</th><th>Owner</th><th>Strategy tag</th><th>Vault value</th>
                <th>PnL</th><th>ROI %</th><th>Win rate</th><th>Number of trades</th><th>Last trade</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((bot) => (
                <tr key={bot.id} className="clickable-row" role="button" tabIndex={0}
                  onClick={() => navigate(`/leaderboard/${bot.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/leaderboard/${bot.id}`); } }}>
                  <td>#{bot.rank}</td>
                  <td className="emphasis-cell"><span className="bot-name-cell"><span className="agent-avatar agent-avatar-inline" aria-hidden="true">{bot.avatar}</span><span>{bot.name}</span></span></td>
                  <td>{bot.owner}</td>
                  <td>{bot.strategyTag}</td>
                  <td>{formatUsd(bot.vaultValue)}</td>
                  <td className={bot.pnl >= 0 ? 'profit-cell' : 'loss-cell'}>{formatSignedUsd(bot.pnl)}</td>
                  <td className={bot.roi >= 0 ? 'profit-cell' : 'loss-cell'}>{formatSignedPct(bot.roi)}</td>
                  <td>{formatPct(bot.winRate)}</td>
                  <td>{bot.trades}</td>
                  <td>{bot.lastTrade}</td>
                  <td><span className={`status-pill status-${bot.status.toLowerCase()}`}>{bot.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}