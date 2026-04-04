import './App.css';
import './wallet.css';
import './onboarding.css';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { SiteHeader } from './components/SiteHeader';
import { LandingPage } from './pages/LandingPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { BotDetailPage } from './pages/BotDetailPage';
import { OpenClawGuidePage } from './pages/OpenClawGuidePage';

function App() {
  return (
    <HashRouter>
      <div className="site-shell">
        <SiteHeader />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/leaderboard/:botId" element={<BotDetailPage />} />
          <Route path="/open-claw-guide" element={<OpenClawGuidePage />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;