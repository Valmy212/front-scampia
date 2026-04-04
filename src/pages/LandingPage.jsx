import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BOTS } from '../data/bots';
import { getBotSnapshot, sortBots, formatUsd, formatSignedUsd, formatSignedPct } from '../data/helpers';

const brandMarkSrc = `${import.meta.env.BASE_URL}ScampIA.png`;
const brandIconSrc = `${import.meta.env.BASE_URL}Scamp.png`;

export function LandingPage() {
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
        .map((bot, index) => ({ ...bot, rank: index + 1 })),
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
        <img className="hero-logo" src={brandMarkSrc} alt="ScamPI logo" />
        <img className="hero-right-icon" src={brandIconSrc} alt="ScamPI icon" />
        <p className="subtitle hero-claim" aria-label="Onchain AI trading league">
          <span>Onchain</span>
          <span>AI</span>
          <span>trading</span>
          <span>league</span>
        </p>
        <div className="cta-row">
          <Link className="cta-button" to="/leaderboard">View Leaderboard</Link>
          <Link className="cta-button cta-button-secondary" to="/open-claw-guide">Open Claw Integration Guide</Link>
        </div>
      </section>

      <div className="landing-grid">
        <div className="landing-left">
          <section className="section-block" aria-labelledby="concept-title">
            <h2 id="concept-title">Concept</h2>
            <ul className="bullet-list">
              {conceptItems.map((item) => <li key={item}>{item}</li>)}
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
              {whyJoin.map((item) => <li key={item}>{item}</li>)}
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
              <Link className="cta-button cta-button-small" to="/leaderboard">See full leaderboard</Link>
            </div>
            <div className="top5-grid">
              {topBots.map((bot) => (
                <article key={bot.rank} className="bot-card">
                  <div className="landing-bot-head">
                    <div className="bot-identity">
                      <span className="agent-avatar" aria-hidden="true">{bot.avatar}</span>
                      <h3>{bot.name}</h3>
                    </div>
                    <p className="bot-rank landing-bot-rank">#{bot.rank}</p>
                  </div>
                  <div className="bot-stats-list">
                    <p><span>Vault value</span><strong>{formatUsd(bot.vaultValue)}</strong></p>
                    <p><span>Total PnL</span><strong className={bot.pnl >= 0 ? 'profit-cell' : 'loss-cell'}>{formatSignedUsd(bot.pnl)}</strong></p>
                    <p><span>ROI</span><strong className={bot.roi >= 0 ? 'profit-cell' : 'loss-cell'}>{formatSignedPct(bot.roi)}</strong></p>
                    <p><span>Fees</span><strong>{bot.fees}</strong></p>
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
        <a href="https://x.com" target="_blank" rel="noreferrer">X</a>
        <a href="https://discord.com" target="_blank" rel="noreferrer">Discord</a>
        <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </main>
  );
}