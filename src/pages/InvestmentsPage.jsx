import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useWallet } from '../useWallet';
import { executeVaultDepositFlow, isUserRejectedError } from '../depositFlow';
import {
  connectWallet,
  getUser,
  getVaultBalances,
  getVaultDepositPrecheck,
  getVaultStatus,
  getVaultUserPosition,
  getUserInvestments,
  buildVaultDeposit,
  listVaults,
} from '../api';

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

function formatAddress(address) {
  if (typeof address !== 'string') return 'N/A';
  const value = address.trim();
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function extractApiKey(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.api_key ?? payload.apiKey ?? payload.key ?? null;
}

function mergeUserWithConnectPayload(userData, connectPayload, walletAddress) {
  return {
    ...(userData || {}),
    wallet_address: userData?.wallet_address || connectPayload?.wallet_address || walletAddress || null,
    api_key: extractApiKey(userData) || extractApiKey(connectPayload) || null,
  };
}

function isNativeLikeAddress(address) {
  if (typeof address !== 'string') return false;
  const normalized = address.toLowerCase();
  return (
    normalized === '0x0000000000000000000000000000000000000000' ||
    normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  );
}

function resolveVaultTokenSymbol(vault) {
  if (!vault || typeof vault !== 'object') return 'USDC';

  const symbolCandidates = [
    vault.asset_symbol,
    vault.assetSymbol,
    vault.token_symbol,
    vault.tokenSymbol,
    vault.symbol,
  ];

  for (const candidate of symbolCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toUpperCase();
    }
  }

  const tokenAddress =
    vault.asset_token ??
    vault.assetToken ??
    vault.token_address ??
    vault.token ??
    null;

  if (typeof tokenAddress === 'string' && isNativeLikeAddress(tokenAddress)) {
    return 'ETH';
  }

  return 'USDC';
}

export function InvestmentsPage() {
  const wallet = useWallet();
  const { address, sendBuiltTransaction } = wallet;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [balances, setBalances] = useState(null);
  const [position, setPosition] = useState(null);
  const [investments, setInvestments] = useState([]);
  const [vaults, setVaults] = useState([]);

  const [selectedVaultId, setSelectedVaultId] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [depositStatus, setDepositStatus] = useState('');

  const vaultId = useMemo(() => getVaultId(user), [user]);
  const selectedVault = useMemo(() => {
    if (selectedVaultId === null) return null;
    return vaults.find((item) => {
      const itemVaultId = item?.vault_id ?? item?.vaultId;
      return String(itemVaultId) === String(selectedVaultId);
    }) || null;
  }, [vaults, selectedVaultId]);
  const selectedVaultTokenSymbol = useMemo(
    () => resolveVaultTokenSymbol(selectedVault),
    [selectedVault],
  );

  const refreshData = async (walletAddress, currentUser) => {
    const effectiveVaultId = getVaultId(currentUser);

    const [bal, pos, investmentItems, listedVaults] = await Promise.all([
      getVaultBalances(),
      effectiveVaultId !== null ? getVaultUserPosition(effectiveVaultId, walletAddress).catch(() => null) : Promise.resolve(null),
      getUserInvestments(walletAddress),
      listVaults(),
    ]);

    setBalances(bal);
    setPosition(pos);
    setInvestments(investmentItems);
    setVaults(listedVaults);
  };

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const connectPayload = await connectWallet(address);
        const userData = await getUser(address).catch(() => null);
        if (cancelled) return;

        const mergedUser = mergeUserWithConnectPayload(userData, connectPayload, address);
        setUser(mergedUser);
        await refreshData(address, mergedUser);
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
      const tx = await executeVaultDepositFlow({
        address,
        vaultId: selectedVaultId,
        amountUi: depositAmount,
        selectedVault,
        getVaultStatusFn: getVaultStatus,
        getVaultDepositPrecheckFn: getVaultDepositPrecheck,
        buildVaultDepositFn: buildVaultDeposit,
        sendBuiltTransactionFn: sendBuiltTransaction,
        onStatus: setDepositStatus,
      });

      if (tx && typeof tx.wait === 'function') {
        setDepositStatus('Confirmation onchain...');
        await tx.wait();
      }

      setDepositStatus('Deposit confirmed. Refreshing data...');
      await refreshData(address, user);
      setTimeout(() => setSelectedVaultId(null), 800);
    } catch (err) {
      if (isUserRejectedError(err)) {
        setDepositError('Approve refuse par l utilisateur.');
      } else {
        setDepositError(err.message || 'Deposit error');
      }
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
                <p className="metric-value">{String(position?.shares ?? position?.user_shares ?? investments[0]?.shares ?? 'N/A')}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Value</p>
                <p className="metric-value">{String(position?.value ?? position?.position_value ?? investments[0]?.value ?? 'N/A')}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Profit</p>
                <p className="metric-value">{String(position?.profit ?? position?.pnl ?? investments[0]?.profit ?? 'N/A')}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">API Key</p>
                <p className="metric-value metric-value-small" title={user?.api_key || 'N/A'}>
                  {user?.api_key || 'N/A'}
                </p>
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
                  const ownerAddress = vault.owner || vault.owner_address || 'N/A';
                  return (
                    <article key={String(rowVaultId)} className="section-block vault-list-card">
                      <p className="metric-label">Vault #{String(rowVaultId)}</p>
                      <p className="section-subtitle" title={ownerAddress}>Owner: {formatAddress(ownerAddress)}</p>
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
              <h3>{`Add funds (${selectedVaultTokenSymbol})`}</h3>
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
              <span className="wp-modal-unit">{selectedVaultTokenSymbol}</span>
            </div>
            <button className="wp-modal-submit" onClick={handleDeposit} disabled={depositing}>
              {depositing ? 'Processing...' : `Confirm deposit ${selectedVaultTokenSymbol}`}
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
