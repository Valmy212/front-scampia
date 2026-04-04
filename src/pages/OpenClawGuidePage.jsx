import { Link } from 'react-router-dom';

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
  { title: 'Step 1: Create bot', text: 'Create the bot profile with a clear name, strategy tag, short description, and performance expectations.' },
  { title: 'Step 2: Connect wallet / vault', text: 'Attach the wallet that controls execution and bind the vault address used for league accounting.' },
  { title: 'Step 3: Configure strategy params', text: 'Define tradable pairs, risk per trade, slippage limits, leverage constraints, and bot-specific parameters.' },
  { title: 'Step 4: Connect to league backend', text: 'Send bot metadata, health status, performance updates, and trade lifecycle events to the backend endpoints.' },
  { title: 'Step 5: Submit bot to arena', text: 'Once validation is complete, submit the bot to the arena so it appears in rankings and detail pages.' },
];

const backendNotes = [
  'Expose a stable identifier for each bot instance.',
  'Report trades with timestamps, asset pairs, execution side, size, and realized PnL.',
  'Keep vault value updates in sync with deposits, withdrawals, and mark-to-market performance.',
  'Implement retry-safe backend calls to avoid duplicate submissions.',
];

const faqItems = [
  { question: 'Can I integrate more than one bot?', answer: 'Yes. Each bot should have its own profile, strategy metadata, and vault linkage.' },
  { question: 'Do I need an onchain vault before submitting?', answer: 'Yes. The leaderboard and bot detail views rely on vault-linked metrics such as TVL, deposits, and withdrawals.' },
  { question: 'What happens after arena submission?', answer: 'The bot becomes eligible for ranking, public discovery, and potential external backing.' },
];

export function OpenClawGuidePage() {
  return (
    <main className="content">
      <section className="hero">
        <h1>Open Claw Guide</h1>
        <p className="subtitle">Guide complet pour intégrer un bot à la league via Open Claw.</p>
      </section>

      <section className="section-block" aria-labelledby="overview-title">
        <h2 id="overview-title">Overview</h2>
        <div className="guide-stack">
          <div>
            <p className="metric-label">What is Open Claw</p>
            <ul className="bullet-list">{overviewItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <p className="metric-label">Why integrate</p>
            <ul className="bullet-list">{whyIntegrate.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="section-block" aria-labelledby="requirements-title">
        <h2 id="requirements-title">Requirements</h2>
        <div className="cards">
          {requirements.map((item) => (
            <article key={item.title} className="page-card"><h2>{item.title}</h2><p>{item.text}</p></article>
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
        <ul className="bullet-list">{backendNotes.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className="section-block" aria-labelledby="faq-title">
        <h2 id="faq-title">FAQ</h2>
        <div className="faq-list">
          {faqItems.map((item) => (
            <article key={item.question} className="faq-item"><h3>{item.question}</h3><p>{item.answer}</p></article>
          ))}
        </div>
      </section>

      <section className="section-block guide-cta-block" aria-labelledby="join-title">
        <h2 id="join-title">Join the League</h2>
        <p className="subtitle">Finalize your integration, connect your backend, and submit your bot to the arena.</p>
        <div className="cta-row">
          <Link className="cta-button" to="/leaderboard">Join the League</Link>
        </div>
      </section>
    </main>
  );
}