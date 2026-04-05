import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useWallet } from '../useWallet';
import {
  connectWallet,
  getUser,
  getVaultBalances,
  getVaultUserPosition,
  buildVaultDeposit,
  listVaults,
} from '../api';

function getVaultId(user) {
  if (!user || typeof user !== 'object') return null;
  if (user.vault_id !== undefined && user.vault_id !== null) return user.vault_id;
  if (user.vaultId !== undefined && user.vaultId !== null) return user.vaultId;
  return null;
}

function extractTxPayload(response) {
  if (!response || typeof response !== 'object') return null;
  if (response.tx && typeof response.tx === 'object') return response.tx;
  if (response.transaction && typeof response.transaction === 'object') return response.transaction;
  if (response.txData && typeof response.txData === 'object') return response.txData;
  if (response.to && response.data) return response;
  return null;
}

function unitsFromAmount(amount, decimals = 18) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return '0';
  return String(Math.floor(value * 10 ** decimals));
}

function formatTokenAmount(balance, decimals = 18) {
  const raw = Number(balance || 0);
  return (raw / 10 ** Number(decimals)).toFixed(4);
}

export function InvestmentsPage() {
  const wallet = useWallet();
  const { address, sendBuiltTransaction } = wallet;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [balances, setBalances] = useState(null);
  const [position, setPosition] = useState(null);
  const [vaults, setVaults] = useState([]);

  const [selectedVaultId, setSelectedVaultId] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [depositStatus, setDepositStatus] = useState('');

  const vaultId = useMemo(() => getVaultId(user), [user]);

  const refreshData = async (walletAddress, currentUser) => {
    const effectiveVaultId = getVaultId(currentUser);

    const [bal, pos] = await Promise.all([
      getVaultBalances(),
      effectiveVaultId !== null ? getVaultUserPosition(effectiveVaultId, walletAddress).catch(() => null) : Promise.resolve(null),
    ]);

    setBalances(bal);
    setPosition(pos);

    try {
      const listedVaults = await listVaults();
      if (Array.isArray(listedVaults) && listedVaults.length > 0) {
        setVaults(listedVaults);
        return;
      }
    } catch {
      // TODO(front): replace fallback once backend list endpoint is available everywhere.
    }

    // TODO(back): backend should return a complete list of joinable vaults for this user.
    if (effectiveVaultId !== null) {
      setVaults([{ vault_id: effectiveVaultId, owner: currentUser?.wallet_address || walletAddress }]);
    } else {
      setVaults([]);
    }
  };

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
        await refreshData(address, userData);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Error loading investments');
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

  const handleOpenDeposit = (target) => {
    setSelectedVaultId(target);
    setDepositAmount('');
    setDepositError('');
    setDepositStatus('');
  };

  const handleDeposit = async () => {
    if (!address || selectedVaultId === null) return;
    if (!depositAmount || Number(depositAmount) <= 0) {
      setDepositError('Invalid amount');
      return;
    }

    setDepositing(true);
    setDepositError('');
    setDepositStatus('');

    try {
      const decimals = Number(balances?.ETH?.decimals ?? 18);
      const amount = unitsFromAmount(depositAmount, decimals);
      const buildRes = await buildVaultDeposit(selectedVaultId, amount, address);
      const txPayload = extractTxPayload(buildRes);
      if (!txPayload) {
        throw new Error('Deposit transaction missing in backend response');
      }

      setDepositStatus('Signature MetaMask...');
      const tx = await sendBuiltTransaction(txPayload);
      if (tx && typeof tx.wait === 'function') {
        setDepositStatus('Confirmation onchain...');
        await tx.wait();
      }

      setDepositStatus('Deposit confirmed. Refreshing data...');
      await refreshData(address, user);
      setTimeout(() => setSelectedVaultId(null), 800);
    } catch (err) {
      setDepositError(err.message || 'Deposit error');
      setDepositStatus('');
    } finally {
      setDepositing(false);
    }
  };

  return (
    <main className="content">
      <section className="hero">
        <h1>Investments</h1>
        <p className="subtitle">Vault list and user investment overview.</p>
      </section>

      {!address && (
        <section className="section-block">
          <p className="section-subtitle">Connect your wallet from the header to see investments.</p>
        </section>
      )}

      {loading && (
        <section className="section-block">
          <p className="section-subtitle">Loading vault list...</p>
        </section>
      )}

      {!!error && (
        <section className="section-block">
          <p className="ob-error">{error}</p>
        </section>
      )}

      {address && !loading && !error && (
        <>
          <section className="section-block" aria-labelledby="invest-user-summary-title">
            <div className="section-head">
              <div>
                <h2 id="invest-user-summary-title">My investment</h2>
                <p className="section-subtitle">Vault info, user share, value, and profit.</p>
              </div>
            </div>

            <div className="vault-meta-grid">
              <article className="metric-card">
                <p className="metric-label">Vault ID</p>
                <p className="metric-value">{vaultId !== null ? `#${vaultId}` : 'N/A'}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">User share</p>
                <p className="metric-value">{String(position?.shares ?? position?.user_shares ?? 'N/A')}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Value</p>
                <p className="metric-value">{String(position?.value ?? position?.position_value ?? 'N/A')}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Profit</p>
                <p className="metric-value">{String(position?.profit ?? position?.pnl ?? 'N/A')}</p>
              </article>
            </div>
          </section>

          <section className="section-block" aria-labelledby="invest-vault-list-title">
            <div className="section-head">
              <div>
                <h2 id="invest-vault-list-title">Vault list</h2>
                <p className="section-subtitle">Click a vault to add funds.</p>
              </div>
            </div>

            <div className="vault-list-grid">
              {vaults.length > 0 ? (
                vaults.map((vault) => {
                  const rowVaultId = vault.vault_id ?? vault.vaultId;
                  return (
                    <article key={String(rowVaultId)} className="section-block vault-list-card">
                      <p className="metric-label">Vault #{String(rowVaultId)}</p>
                      <p className="section-subtitle">Owner: {vault.owner || vault.owner_address || 'N/A'}</p>
                      <button
                        className="cta-button cta-button-small"
                        type="button"
                        onClick={() => handleOpenDeposit(rowVaultId)}
                      >
                        Add funds
                      </button>
                    </article>
                  );
                })
              ) : (
                <p className="section-subtitle">No vault available right now.</p>
              )}
            </div>
          </section>

          <section className="section-block" aria-labelledby="invest-balance-table-title">
            <div className="section-head">
              <div>
                <h2 id="invest-balance-table-title">Vault balances</h2>
              </div>
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
              <Link className="cta-button" to="/vault-status">Vault Status</Link>
              <Link className="cta-button cta-button-secondary" to="/onboarding-actions">Onboarding Actions</Link>
            </div>
          </section>
        </>
      )}

      {selectedVaultId !== null && createPortal(
        <div className="wp-overlay" onClick={() => setSelectedVaultId(null)}>
          <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-head">
              <h3>Add funds</h3>
              <button className="wp-modal-close" onClick={() => setSelectedVaultId(null)}>✕</button>
            </div>
            <div className="wp-modal-balance">
              <span>Target vault</span>
              <strong>#{String(selectedVaultId)}</strong>
            </div>
            <label className="wp-modal-label">Amount to deposit</label>
            <div className="wp-modal-input-wrap">
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => {
                  setDepositAmount(e.target.value);
                  setDepositError('');
                }}
                disabled={depositing}
                autoFocus
              />
              <span className="wp-modal-unit">ETH</span>
            </div>
            <button className="wp-modal-submit" onClick={handleDeposit} disabled={depositing}>
              {depositing ? 'Processing...' : 'Confirm deposit'}
            </button>
            {!!depositError && <p className="wp-modal-error">{depositError}</p>}
            {!!depositStatus && <p className="wp-modal-success">{depositStatus}</p>}
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
