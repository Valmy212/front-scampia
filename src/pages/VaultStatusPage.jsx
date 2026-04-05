import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../useWallet';
import { connectWallet, getUser, getVaultBalances, getVaultStatus, getVaultUserPosition } from '../api';

function getVaultId(user) {
  if (!user || typeof user !== 'object') return null;
  if (user.vault_id !== undefined && user.vault_id !== null) return user.vault_id;
  if (user.vaultId !== undefined && user.vaultId !== null) return user.vaultId;
  return null;
}

function formatTokenAmount(balance, decimals = 18) {
  const raw = Number(balance || 0);
  return (raw / 10 ** Number(decimals)).toFixed(4);
}

export function VaultStatusPage() {
  const wallet = useWallet();
  const { address } = wallet;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [balances, setBalances] = useState(null);
  const [vaultStatus, setVaultStatus] = useState(null);
  const [position, setPosition] = useState(null);

  const vaultId = useMemo(() => getVaultId(user), [user]);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        await connectWallet(address);
        const userData = await getUser(address);
        if (cancelled) return;

        setUser(userData);

        const vaultIdentifier = getVaultId(userData);
        const [bal, statusData, positionData] = await Promise.all([
          getVaultBalances(),
          vaultIdentifier !== null ? getVaultStatus(vaultIdentifier).catch(() => null) : Promise.resolve(null),
          vaultIdentifier !== null ? getVaultUserPosition(vaultIdentifier, address).catch(() => null) : Promise.resolve(null),
        ]);

        if (cancelled) return;
        setBalances(bal);
        setVaultStatus(statusData);
        setPosition(positionData);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Error loading vault status');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <main className="content">
      <section className="hero">
        <h1>Vault Status</h1>
        <p className="subtitle">Vault status overview and user position metrics.</p>
      </section>

      {!address && (
        <section className="section-block">
          <p className="section-subtitle">Connect your wallet from the header to see vault status.</p>
        </section>
      )}

      {loading && (
        <section className="section-block">
          <p className="section-subtitle">Loading vault status...</p>
        </section>
      )}

      {!!error && (
        <section className="section-block">
          <p className="ob-error">{error}</p>
        </section>
      )}

      {address && !loading && !error && (
        <>
          <section className="section-block" aria-labelledby="vault-status-main-title">
            <div className="section-head">
              <div>
                <h2 id="vault-status-main-title">Vault information</h2>
                <p className="section-subtitle">Primary vault detected for your wallet.</p>
              </div>
            </div>
            <div className="vault-meta-grid">
              <article className="metric-card">
                <p className="metric-label">Wallet</p>
                <p className="metric-value metric-value-small">{address}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Vault ID</p>
                <p className="metric-value">{vaultId !== null ? `#${vaultId}` : 'N/A'}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Vault owner</p>
                <p className="metric-value metric-value-small">{vaultStatus?.owner || user?.wallet_address || 'N/A'}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Owner fee bps</p>
                <p className="metric-value">{String(vaultStatus?.owner_fee_bps ?? user?.owner_fee_bps ?? 'N/A')}</p>
              </article>
            </div>
          </section>

          <section className="section-block" aria-labelledby="vault-status-balance-title">
            <div className="section-head">
              <div>
                <h2 id="vault-status-balance-title">Balances and position</h2>
                <p className="section-subtitle">Vault state and user share details.</p>
              </div>
            </div>
            <div className="vault-meta-grid">
              <article className="metric-card">
                <p className="metric-label">User shares</p>
                <p className="metric-value">{String(position?.shares ?? position?.user_shares ?? 'N/A')}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Position value</p>
                <p className="metric-value">{String(position?.value ?? position?.position_value ?? 'N/A')}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Position profit</p>
                <p className="metric-value">{String(position?.profit ?? position?.pnl ?? 'N/A')}</p>
              </article>
            </div>

            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Balance</th>
                    <th>Raw</th>
                  </tr>
                </thead>
                <tbody>
                  {balances && Object.keys(balances).length > 0 ? (
                    Object.entries(balances).map(([symbol, info]) => (
                      <tr key={symbol}>
                        <td>{symbol}</td>
                        <td>{formatTokenAmount(info.balance, info.decimals)}</td>
                        <td>{String(info.balance)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>No balances returned</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section-block">
            <div className="cta-row">
              <Link className="cta-button" to="/investments">View investments</Link>
              <Link className="cta-button cta-button-secondary" to="/onboarding-actions">Back to onboarding actions</Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
