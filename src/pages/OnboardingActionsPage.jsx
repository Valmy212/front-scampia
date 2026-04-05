import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../useWallet';
import { buildCreateVault, connectWallet, getUser, listVaults } from '../api';

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

export function OnboardingActionsPage() {
  const wallet = useWallet();
  const { address, connect, loading, error, sendBuiltTransaction } = wallet;

  const [ownerFeeBps, setOwnerFeeBps] = useState('300');
  const [actionStatus, setActionStatus] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [vaults, setVaults] = useState([]);

  const activeVaultId = useMemo(() => getVaultId(user), [user]);

  const handleConnectWallet = async () => {
    setActionError('');
    setActionStatus('');

    const connectedAddress = await connect();
    if (!connectedAddress) return;

    setBusy(true);
    try {
      setActionStatus('Syncing wallet profile...');
      await connectWallet(connectedAddress);
      const userData = await getUser(connectedAddress);
      setUser(userData);
      const allVaults = await listVaults();
      setVaults(allVaults);

      setActionStatus('Wallet connected. You can create a vault now.');
    } catch (err) {
      setActionError(err.message || 'Wallet connection error');
      setActionStatus('');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateVault = async () => {
    if (!address || busy) return;

    const fee = Number(ownerFeeBps);
    if (!Number.isInteger(fee) || fee < 0 || fee > 5000) {
      setActionError('Invalid owner fee bps (0 to 5000).');
      return;
    }

    setBusy(true);
    setActionError('');
    try {
      setActionStatus('Preparing create vault transaction...');
      const buildRes = await buildCreateVault(fee);
      const txPayload = extractTxPayload(buildRes);
      if (!txPayload) {
        throw new Error('Create vault transaction not found in backend response');
      }

      setActionStatus('Signature MetaMask...');
      const tx = await sendBuiltTransaction(txPayload);

      if (tx && typeof tx.wait === 'function') {
        setActionStatus('Confirmation onchain...');
        await tx.wait();
      }

      setActionStatus('Vault created. Updating profile...');
      await connectWallet(address);
      const userData = await getUser(address);
      setUser(userData);
      const allVaults = await listVaults();
      setVaults(allVaults);

      const newVaultId = getVaultId(userData);
      if (newVaultId !== null) {
        setActionStatus(`Vault #${newVaultId} created successfully.`);
      } else {
        setActionStatus('Vault created. Waiting for backend vault_id synchronization.');
      }
    } catch (err) {
      setActionError(err.message || 'Create vault error');
      setActionStatus('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="content">
      <section className="hero">
        <h1>Onboarding Actions</h1>
        <p className="subtitle">Split flow: connect wallet, then create vault.</p>
      </section>

      <section className="section-block" aria-labelledby="wallet-connect-title">
        <div className="section-head">
          <div>
            <h2 id="wallet-connect-title">Action 1: Connect Wallet</h2>
            <p className="section-subtitle">This button only triggers wallet connection.</p>
          </div>
        </div>

        <div className="vault-page-actions">
          <button className="cta-button" type="button" onClick={handleConnectWallet} disabled={busy || loading}>
            {loading || busy ? 'Connecting...' : 'Connect Wallet'}
          </button>
          <span className="vault-inline-text">Wallet: {address || 'not connected'}</span>
        </div>
        {error && <p className="ob-error">{error}</p>}
      </section>

      <section className="section-block" aria-labelledby="create-vault-title">
        <div className="section-head">
          <div>
            <h2 id="create-vault-title">Action 2: Create Vault</h2>
            <p className="section-subtitle">This button appears once the wallet is connected.</p>
          </div>
        </div>

        {address ? (
          <div className="vault-action-grid">
            <label className="vault-inline-label" htmlFor="ownerFeeBps">
              Owner fee (bps)
            </label>
            <input
              id="ownerFeeBps"
              className="vault-inline-input"
              type="number"
              min="0"
              max="5000"
              value={ownerFeeBps}
              onChange={(e) => setOwnerFeeBps(e.target.value)}
              disabled={busy}
            />
            <button className="cta-button" type="button" onClick={handleCreateVault} disabled={busy}>
              {busy ? 'Processing...' : 'Create Vault'}
            </button>
          </div>
        ) : (
          <p className="section-subtitle">Connect your wallet to enable vault creation.</p>
        )}

        {!!actionStatus && <p className="vault-ok-text">{actionStatus}</p>}
        {!!actionError && <p className="ob-error">{actionError}</p>}
      </section>

      <section className="section-block" aria-labelledby="onboarding-overview-title">
        <div className="section-head">
          <div>
            <h2 id="onboarding-overview-title">Quick status</h2>
            <p className="section-subtitle">Navigate to vault status and investments pages.</p>
          </div>
        </div>

        <div className="vault-meta-grid">
          <article className="metric-card">
            <p className="metric-label">Current vault</p>
            <p className="metric-value">{activeVaultId !== null ? `#${activeVaultId}` : 'N/A'}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Vault list loaded</p>
            <p className="metric-value">{vaults.length}</p>
          </article>
        </div>

        <div className="cta-row">
          <Link className="cta-button" to="/vault-status">Vault Status Page</Link>
          <Link className="cta-button cta-button-secondary" to="/investments">Investments Page</Link>
        </div>
      </section>
    </main>
  );
}
