import { Link, NavLink } from 'react-router-dom';
import { WalletPanel } from './WalletPanel';

const brandIconSrc = `${import.meta.env.BASE_URL}Scamp.png`;
const brandMarkSrc = `${import.meta.env.BASE_URL}ScampIA.png`;

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Onboarding', to: '/onboarding-actions' },
  { label: 'Vault Status', to: '/vault-status' },
  { label: 'Investments', to: '/investments' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'Open Claw Tuto', to: '/open-claw-guide' },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="ScamPI home">
        <img className="brand-icon" src={brandIconSrc} alt="ScamPI icon" />
        <img className="brand-mark" src={brandMarkSrc} alt="ScamPI" />
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
      <WalletPanel />
    </header>
  );
}