import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../useWallet';
import { buildCreateVault, connectWallet, getUser, getUserVaultSync, listVaults } from '../api';

const DEFAULT_SYNC_RETRY_SECONDS = 2;
const MAX_VAULT_SYNC_WAIT_MS = 60000;
const INITIAL_SYNC_UI = {
  state: 'idle',
  attempt: 0,
  nextRetrySeconds: 0,
  elapsedSeconds: 0,
};

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

function normalizeSyncState(payload) {
  const vaultId = getVaultId(payload);
  const pendingFlag = payload?.pending_sync;
  const retryRaw = Number(payload?.retry_after_seconds);
  const retryAfterSeconds = Number.isFinite(retryRaw) && retryRaw > 0 ? retryRaw : DEFAULT_SYNC_RETRY_SECONDS;
  const pendingSync = typeof pendingFlag === 'boolean' ? pendingFlag : vaultId === null;

  return {
    pendingSync,
    retryAfterSeconds,
    vaultId,
  };
}

function waitMs(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function isNotFoundResponseError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('not found') || message.includes('"detail":"not found"');
}

export function OnboardingActionsPage() {
  const wallet = useWallet();
  const { address, connect, loading, error, sendBuiltTransaction } = wallet;

  const [ownerFeeBps, setOwnerFeeBps] = useState('300');
  const [actionStatus, setActionStatus] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [canRetrySync, setCanRetrySync] = useState(false);
  const [syncUi, setSyncUi] = useState(INITIAL_SYNC_UI);
  const [user, setUser] = useState(null);
  const [vaults, setVaults] = useState([]);

  const activeVaultId = useMemo(() => getVaultId(user), [user]);

  const shouldShowRetrySync = (message) => {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('sync') || normalized.includes('vault_id') || normalized.includes('timeout');
  };

  const updateSyncUi = (patch) => {
    setSyncUi((prev) => ({ ...prev, ...patch }));
  };

  const getSyncBadgeLabel = () => {
    if (syncUi.state === 'pending') return 'Backend sync pending';
    if (syncUi.state === 'ready') return 'Backend sync ready';
    if (syncUi.state === 'timeout') return 'Backend sync timeout';
    if (syncUi.state === 'error') return 'Backend sync error';
    return 'Backend sync idle';
  };

  const waitForVaultSynchronization = async (initialPayload) => {
    let syncPayload = initialPayload;
    let syncState = normalizeSyncState(syncPayload);
    const syncStartedAt = Date.now();
    let attempts = 0;
    let useLegacyUserPolling = false;
    let legacyFallbackAnnounced = false;

    if (syncState.pendingSync || syncState.vaultId === null) {
      setActionStatus('Vault created. Waiting for backend vault_id synchronization...');
      updateSyncUi({
        state: 'pending',
        attempt: 0,
        nextRetrySeconds: syncState.retryAfterSeconds,
        elapsedSeconds: 0,
      });

      while (syncState.pendingSync) {
        if (Date.now() - syncStartedAt >= MAX_VAULT_SYNC_WAIT_MS) {
          updateSyncUi({ state: 'timeout', nextRetrySeconds: 0 });
          throw new Error('Backend vault sync timeout. Please retry in a few seconds.');
        }

        attempts += 1;
        const waitSeconds = Math.max(1, Math.ceil(syncState.retryAfterSeconds));

        for (let remaining = waitSeconds; remaining > 0; remaining -= 1) {
          updateSyncUi({
            state: 'pending',
            attempt: attempts,
            nextRetrySeconds: remaining,
            elapsedSeconds: Math.floor((Date.now() - syncStartedAt) / 1000),
          });
          await waitMs(1000);
        }

        try {
          if (useLegacyUserPolling) {
            syncPayload = await getUser(address);
          } else {
            const vaultSyncPayload = await getUserVaultSync(address);
            if (vaultSyncPayload === null) {
              useLegacyUserPolling = true;
              syncPayload = await getUser(address);
            } else {
              syncPayload = vaultSyncPayload;
            }
          }
        } catch (err) {
          if (!useLegacyUserPolling && isNotFoundResponseError(err)) {
            useLegacyUserPolling = true;
            syncPayload = await getUser(address);
          } else {
            throw err;
          }
        }

        if (useLegacyUserPolling && !legacyFallbackAnnounced) {
          setActionStatus('Sync endpoint unavailable. Polling user profile as fallback...');
          legacyFallbackAnnounced = true;
        }

        syncState = normalizeSyncState(syncPayload);

        if (!syncState.pendingSync && syncState.vaultId !== null) {
          updateSyncUi({
            state: 'ready',
            attempt: attempts,
            nextRetrySeconds: 0,
            elapsedSeconds: Math.floor((Date.now() - syncStartedAt) / 1000),
          });
        }
      }

      if (syncState.vaultId === null) {
        updateSyncUi({ state: 'error', nextRetrySeconds: 0 });
        throw new Error('Vault sync completed but vault_id is missing in backend response.');
      }
    } else {
      updateSyncUi({
        state: 'ready',
        attempt: 0,
        nextRetrySeconds: 0,
        elapsedSeconds: 0,
      });
    }

    return { syncPayload, syncState };
  };

  const refreshProfileState = async (syncPayload, fallbackVaultId = null) => {
    const userData = await getUser(address);
    const localVaultId = getVaultId(userData);
    const resolvedVaultId = localVaultId ?? getVaultId(syncPayload) ?? fallbackVaultId;

    setUser(localVaultId !== null ? userData : syncPayload);
    const allVaults = await listVaults();
    setVaults(allVaults);

    return resolvedVaultId;
  };

  const handleConnectWallet = async () => {
    setActionError('');
    setActionStatus('');
    setSyncUi(INITIAL_SYNC_UI);

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
    setCanRetrySync(false);
    setSyncUi(INITIAL_SYNC_UI);
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
      const connectPayload = await connectWallet(address);
      const { syncPayload, syncState } = await waitForVaultSynchronization(connectPayload);
      const newVaultId = await refreshProfileState(syncPayload, syncState.vaultId);
      if (newVaultId !== null) {
        setActionStatus(`Vault #${newVaultId} created successfully.`);
      } else {
        setActionStatus('Vault created. Waiting for backend vault_id synchronization.');
      }
    } catch (err) {
      const message = err.message || 'Create vault error';
      setActionError(message);
      setCanRetrySync(shouldShowRetrySync(message));
      updateSyncUi({ state: shouldShowRetrySync(message) && message.toLowerCase().includes('timeout') ? 'timeout' : 'error', nextRetrySeconds: 0 });
      setActionStatus('');
    } finally {
      setBusy(false);
    }
  };

  const handleRetrySync = async () => {
    if (!address || busy) return;

    setBusy(true);
    setActionError('');
    setCanRetrySync(false);
    updateSyncUi({ state: 'pending', attempt: 0, nextRetrySeconds: 0, elapsedSeconds: 0 });

    try {
      setActionStatus('Retrying backend vault_id synchronization...');
      const connectPayload = await connectWallet(address).catch(() => null);
      const { syncPayload: syncedPayload, syncState } = await waitForVaultSynchronization(connectPayload);
      const syncedVaultId = await refreshProfileState(syncedPayload, syncState.vaultId);

      if (syncedVaultId === null) {
        throw new Error('Vault synchronization retry finished but no vault_id was found.');
      }

      setActionStatus(`Vault #${syncedVaultId} synchronized successfully.`);
    } catch (err) {
      const message = err.message || 'Vault synchronization retry error';
      setActionError(message);
      setCanRetrySync(shouldShowRetrySync(message));
      updateSyncUi({ state: shouldShowRetrySync(message) && message.toLowerCase().includes('timeout') ? 'timeout' : 'error', nextRetrySeconds: 0 });
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
          {!address && (
            <button className="cta-button" type="button" onClick={handleConnectWallet} disabled={busy || loading}>
              {loading || busy ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
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
        {syncUi.state !== 'idle' && (
          <div className="sync-status-wrap" role="status" aria-live="polite">
            <span className={`sync-badge sync-badge-${syncUi.state}`}>{getSyncBadgeLabel()}</span>
            {syncUi.state === 'pending' && (
              <p className="sync-meta-text">
                Attempt {syncUi.attempt || 1} · next check in {syncUi.nextRetrySeconds}s · elapsed {syncUi.elapsedSeconds}s
              </p>
            )}
            {syncUi.state === 'ready' && (
              <p className="sync-meta-text">Synchronization completed in {syncUi.elapsedSeconds}s.</p>
            )}
          </div>
        )}
        {address && canRetrySync && (
          <div className="cta-row">
            <button className="cta-button cta-button-secondary" type="button" onClick={handleRetrySync} disabled={busy}>
              {busy ? 'Retrying sync...' : 'Retry sync'}
            </button>
          </div>
        )}
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
