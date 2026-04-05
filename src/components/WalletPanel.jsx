import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BrowserProvider, formatEther } from "ethers";
import { useWallet } from "../useWallet";
import {
  executeVaultDepositFlow,
  extractTxPayload,
  isUserRejectedError,
  normalizePrecheckPayload,
} from "../depositFlow";
import {
  connectWallet,
  getUser,
  getVaultBalances,
  getVaultDepositPrecheck,
  getVaultStatus,
  getVaultUserPosition,
  buildVaultDeposit,
  buildVaultWithdraw,
} from "../api";

function shortAddr(addr) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function formatBal(balance, decimals) {
  return (balance / 10 ** decimals).toFixed(4);
}

function unitsFromAmount(amount, decimals = 18) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "0";
  return String(Math.floor(value * 10 ** decimals));
}

function getVaultId(user) {
  if (!user || typeof user !== "object") return null;
  if (user.vault_id !== undefined && user.vault_id !== null) return user.vault_id;
  if (user.vaultId !== undefined && user.vaultId !== null) return user.vaultId;
  return null;
}

function isNativeLikeAddress(address) {
  if (typeof address !== "string") return false;
  const normalized = address.toLowerCase();
  return (
    normalized === "0x0000000000000000000000000000000000000000" ||
    normalized === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  );
}

function extractApiKey(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.api_key ?? payload.apiKey ?? payload.key ?? null;
}

function mergeUserWithConnectPayload(userData, connectPayload, walletAddress) {
  return {
    ...(userData || {}),
    wallet_address: userData?.wallet_address || connectPayload?.wallet_address || walletAddress || null,
    api_key: extractApiKey(userData) || extractApiKey(connectPayload) || null,
  };
}


export function WalletPanel() {
  const wallet = useWallet();
  const { address, loading, error: walletError, connect, disconnect, sendBuiltTransaction, autoChecked } = wallet;

  const [user, setUser] = useState(null);
  const [balances, setBalances] = useState(null);
  const [walletEthBalance, setWalletEthBalance] = useState("0");
  const [position, setPosition] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [checking, setChecking] = useState(false);

  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [depositStatus, setDepositStatus] = useState("");
  const [depositDebug, setDepositDebug] = useState(null);
  const [depositPrecheckUi, setDepositPrecheckUi] = useState({
    loading: false,
    requiresApproval: null,
    isNativeAsset: null,
    tokenSymbol: null,
    tokenAddress: null,
    message: "",
  });

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");

  const dropdownRef = useRef(null);
  const checkedRef = useRef(false);

  const refreshWalletBalance = async (targetAddress = address) => {
    if (!targetAddress || !window.ethereum) {
      setWalletEthBalance("0");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const balanceWei = await provider.getBalance(targetAddress);
      setWalletEthBalance(Number(formatEther(balanceWei)).toFixed(4));
    } catch {
      // Keep existing display value if a transient RPC issue occurs.
    }
  };

  const refreshBalances = async (userData = user) => {
    if (!address) return;

    await refreshWalletBalance(address);
    if (!userData) return;

    const bal = await getVaultBalances();
    setBalances(bal);

    const vaultId = getVaultId(userData);
    if (vaultId !== null) {
      const pos = await getVaultUserPosition(vaultId, address);
      setPosition(pos);
    }
  };

  useEffect(() => {
    if (!address || !autoChecked || checkedRef.current) return;
    checkedRef.current = true;
    setChecking(true);

    refreshWalletBalance(address).catch(() => {});

    Promise.all([
      connectWallet(address).catch(() => null),
      getUser(address).catch(() => null),
    ])
      .then(([connectPayload, userData]) => {
        const mergedUser = mergeUserWithConnectPayload(userData, connectPayload, address);
        if (getVaultId(mergedUser) !== null) {
          setUser(mergedUser);
          setOnboarded(true);
          return refreshBalances(mergedUser);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [address, autoChecked]);

  useEffect(() => {
    if (!address) {
      setWalletEthBalance("0");
      return;
    }

    const timer = setInterval(() => {
      refreshWalletBalance(address).catch(() => {});
    }, 15000);

    return () => clearInterval(timer);
  }, [address]);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const vaultId = getVaultId(user);

    if (!showDeposit || !address || vaultId === null) {
      setDepositPrecheckUi({
        loading: false,
        requiresApproval: null,
        isNativeAsset: null,
          tokenSymbol: null,
          tokenAddress: null,
        message: "",
      });
      return;
    }

    setDepositPrecheckUi((prev) => ({
      ...prev,
      loading: true,
      message: "",
    }));

    getVaultDepositPrecheck(vaultId, address, 0)
      .then(async (basePayload) => {
        if (cancelled) return;
        const baseNormalized = normalizePrecheckPayload(basePayload);

        if (!depositAmount || Number(depositAmount) <= 0) {
          setDepositPrecheckUi({
            loading: false,
            requiresApproval:
              baseNormalized?.requiresApproval ??
              baseNormalized?.needsApproval ??
              null,
            isNativeAsset: baseNormalized?.isNativeAsset ?? null,
            tokenSymbol: baseNormalized?.assetSymbol ?? null,
            tokenAddress: baseNormalized?.tokenAddress ?? null,
            message: baseNormalized?.message || "",
          });
          return;
        }

        const decimals = Number(baseNormalized?.decimals ?? 18);
        const amountRaw = unitsFromAmount(depositAmount, decimals);
        const payload = await getVaultDepositPrecheck(vaultId, address, amountRaw);
        if (cancelled) return;
        const normalized = normalizePrecheckPayload(payload);
        setDepositPrecheckUi({
          loading: false,
          requiresApproval:
            normalized?.requiresApproval ??
            normalized?.needsApproval ??
            null,
          isNativeAsset: normalized?.isNativeAsset ?? null,
            tokenSymbol: normalized?.assetSymbol ?? null,
            tokenAddress: normalized?.tokenAddress ?? null,
          message: normalized?.message || "",
        });
      })
      .catch(() => {
        if (cancelled) return;
        setDepositPrecheckUi((prev) => ({
          ...prev,
          loading: false,
          message: "",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [showDeposit, user, address, depositAmount]);

  // Deposit

  const handleDeposit = async () => {
    const vaultId = getVaultId(user);
    if (vaultId === null || !depositAmount || Number(depositAmount) <= 0) return;

    setDepositing(true);
    setDepositError("");
    setDepositStatus("");
    setDepositDebug(null);
    try {
      const tx = await executeVaultDepositFlow({
        address,
        vaultId,
        amountUi: depositAmount,
        getVaultStatusFn: getVaultStatus,
        getVaultDepositPrecheckFn: getVaultDepositPrecheck,
        buildVaultDepositFn: buildVaultDeposit,
        sendBuiltTransactionFn: sendBuiltTransaction,
        onStatus: setDepositStatus,
        onDebug: setDepositDebug,
        onPrecheck: ({ precheck }) => {
          if (!precheck) return;
          setDepositPrecheckUi((prev) => ({
            ...prev,
            loading: false,
            requiresApproval:
              precheck.requiresApproval ??
              precheck.needsApproval ??
              prev.requiresApproval,
            isNativeAsset: precheck.isNativeAsset ?? prev.isNativeAsset,
              tokenSymbol: precheck.assetSymbol ?? prev.tokenSymbol,
              tokenAddress: precheck.tokenAddress ?? prev.tokenAddress,
            message: precheck.message || prev.message,
          }));
        },
      });

      if (tx && typeof tx.wait === "function") {
        setDepositStatus("Confirmation onchain...");
        await tx.wait();
      }

      setShowDeposit(false);
      setDepositAmount("");
      setDepositStatus("");
      setTimeout(refreshBalances, 6000);
    } catch (err) {
      if (isUserRejectedError(err)) {
        setDepositError("Approve refuse par l utilisateur.");
      } else if (String(err?.message || "").toLowerCase().includes("insufficient funds")) {
        setDepositError("Insufficient MetaMask balance. Add more ETH to your wallet.");
      } else {
        setDepositError("Error: " + err.message);
      }
      setDepositStatus("");
    } finally {
      setDepositing(false);
    }
  };

  // Withdraw

  const handleWithdraw = async () => {
    const vaultId = getVaultId(user);
    if (vaultId === null || !withdrawAmount || Number(withdrawAmount) <= 0) return;

    setWithdrawing(true);
    setWithdrawError("");
    setWithdrawSuccess("");
    try {
      const decimals = Number(balances?.ETH?.decimals ?? 18);
      const shares = unitsFromAmount(withdrawAmount, decimals);
      const buildRes = await buildVaultWithdraw(vaultId, shares, address);
      const txPayload = extractTxPayload(buildRes);

      if (!txPayload) {
        throw new Error("Transaction payload not found in backend response");
      }

      const tx = await sendBuiltTransaction(txPayload);
      setWithdrawSuccess("Withdraw completed. Tx: " + shortAddr(tx.hash || tx.txHash));
      setWithdrawAmount("");
      setTimeout(refreshBalances, 3000);
    } catch (err) {
      const msg = err.message;
      if (msg.includes("insufficient") || msg.includes("tried to withdraw")) {
        setWithdrawError("Insufficient vault balance.");
      } else {
        setWithdrawError("Error: " + msg);
      }
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setUser(null);
    setBalances(null);
    setWalletEthBalance("0");
    setPosition(null);
    setDropdownOpen(false);
    setOnboarded(false);
    checkedRef.current = false;
  };

  const handleConnect = async () => {
    const connectedAddress = await connect();
    if (!connectedAddress) return;

    setChecking(true);
    try {
      const connectPayload = await connectWallet(connectedAddress).catch(() => null);
      const userData = await getUser(connectedAddress).catch(() => null);
      const mergedUser = mergeUserWithConnectPayload(userData, connectPayload, connectedAddress);
      if (getVaultId(mergedUser) !== null) {
        setUser(mergedUser);
        setOnboarded(true);
        await refreshBalances(mergedUser);
      }
    } finally {
      setChecking(false);
    }
  };

  const ethBalance = balances?.ETH
    ? formatBal(balances.ETH.balance, Number(balances.ETH.decimals ?? 18))
    : "0";
  const vaultEthBalance = ethBalance;
  const userShares = position?.shares ?? position?.user_shares;
  const depositPresets = ["0.001", "0.005", "0.01", "0.05"];
  const withdrawPresets = ["0.001", "0.005", "0.01"];
  const precheckTokenIsNative = (() => {
    if (depositPrecheckUi.tokenAddress) {
      return isNativeLikeAddress(depositPrecheckUi.tokenAddress);
    }

    // If backend explicitly requests approve, treat it as ERC-20 even when
    // native flags are inconsistent.
    if (depositPrecheckUi.requiresApproval === true) {
      return false;
    }

    return depositPrecheckUi.isNativeAsset === true;
  })();
  const normalizedPrecheckSymbol =
    typeof depositPrecheckUi.tokenSymbol === "string" && depositPrecheckUi.tokenSymbol.trim()
      ? depositPrecheckUi.tokenSymbol.trim().toUpperCase()
      : null;
  const symbolLooksWrongForErc20 =
    normalizedPrecheckSymbol === "ETH" &&
    typeof depositPrecheckUi.tokenAddress === "string" &&
    !isNativeLikeAddress(depositPrecheckUi.tokenAddress);
  const depositTokenSymbol = (() => {
    if (normalizedPrecheckSymbol && !symbolLooksWrongForErc20) return normalizedPrecheckSymbol;
    if (precheckTokenIsNative) return "ETH";
    return "USDC";
  })();

  const depositActionLabel = (() => {
    if (depositPrecheckUi.isNativeAsset === true) return "Send native deposit";
    if (depositPrecheckUi.requiresApproval === true) return "Approve then deposit";
    return "Deposit";
  })();

  const depositPrecheckBadge = (() => {
    if (depositPrecheckUi.loading) return "Checking route...";
    if (depositPrecheckUi.isNativeAsset === true) return "Precheck: native asset";
    if (depositPrecheckUi.requiresApproval === true) return "Precheck: approval required";
    if (depositPrecheckUi.requiresApproval === false) return "Precheck: direct deposit";
    return "Precheck pending";
  })();

  const connectErrorMessage = (() => {
    if (!walletError) return "";
    const lowered = String(walletError).toLowerCase();
    if (lowered.includes("user rejected") || lowered.includes("action_rejected")) {
      return "Connection cancelled in MetaMask.";
    }
    if (lowered.includes("metamask")) {
      return walletError;
    }
    return `Wallet connection error: ${walletError}`;
  })();

  if (checking) {
    return (
      <div style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
        Loading…
      </div>
    );
  }

  if (!address) {
    return (
      <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
        <button
          className="cta-button cta-button-small"
          onClick={handleConnect}
          disabled={loading}
          style={{ whiteSpace: "nowrap" }}
        >
          {loading ? "Connecting..." : "Connect Wallet"}
        </button>
        {!!connectErrorMessage && (
          <span
            role="alert"
            style={{ color: "#f87171", fontSize: "12px", maxWidth: "230px", textAlign: "right", lineHeight: 1.2 }}
          >
            {connectErrorMessage}
          </span>
        )}
      </div>
    );
  }

  if (!onboarded) {
    return (
      <button
        className="cta-button cta-button-small"
        onClick={handleDisconnect}
        style={{ marginLeft: "auto", whiteSpace: "nowrap" }}
      >
        Disconnect
      </button>
    );
  }

  return (
    <>
      <div className="wp-top-actions">
        <button
          className="cta-button cta-button-small cta-button-secondary"
          onClick={handleDisconnect}
          style={{ whiteSpace: "nowrap" }}
        >
          Disconnect
        </button>

        <div className="wp" ref={dropdownRef}>
          <button className="wp-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <span className="wp-dot" />
            <span className="wp-addr">{shortAddr(address)}</span>
            <span className="wp-bal">{walletEthBalance} ETH</span>
            <span className={`wp-chevron ${dropdownOpen ? "wp-chevron-open" : ""}`}>▾</span>
          </button>

          {dropdownOpen && (
            <div className="wp-dropdown">
              <div className="wp-dd-section">
                <div className="wp-dd-label">Wallet</div>
                <div className="wp-dd-value">{shortAddr(address)}</div>
              </div>
              <div className="wp-dd-section">
                <div className="wp-dd-label">API key</div>
                <div className="wp-dd-value" title={user?.api_key || "N/A"}>{user?.api_key || "N/A"}</div>
              </div>
              {user && (
                <div className="wp-dd-section">
                  <div className="wp-dd-label">Vault</div>
                  <div className="wp-dd-value">ID #{String(getVaultId(user))}</div>
                </div>
              )}
              {userShares !== undefined && userShares !== null && (
                <div className="wp-dd-section">
                  <div className="wp-dd-label">Your shares</div>
                  <div className="wp-dd-value">{String(userShares)}</div>
                </div>
              )}
              <div className="wp-dd-divider" />
              <div className="wp-dd-section">
                <div className="wp-dd-label">Balances</div>
                {balances ? (
                  Object.entries(balances).map(([symbol, info]) => (
                    <div key={symbol} className="wp-dd-balance">
                      <span>{symbol}</span>
                      <span>{formatBal(info.balance, info.decimals)}</span>
                    </div>
                  ))
                ) : (
                  <div className="wp-dd-empty">Loading…</div>
                )}
              </div>
              <div className="wp-dd-divider" />
              <div className="wp-dd-actions">
                <button className="wp-dd-btn wp-dd-btn-primary" onClick={() => { setShowDeposit(true); setDropdownOpen(false); setDepositError(""); setDepositStatus(""); setDepositDebug(null); }}>
                  Deposit
                </button>
                <button className="wp-dd-btn wp-dd-btn-withdraw" onClick={() => { setShowWithdraw(true); setDropdownOpen(false); setWithdrawError(""); setWithdrawSuccess(""); }}>
                  Withdraw
                </button>
              </div>
              <button className="wp-dd-disconnect" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Deposit modal */}
      {showDeposit && createPortal(
        <div className="wp-overlay" onClick={() => { setShowDeposit(false); setDepositDebug(null); }}>
          <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-head">
                <h3>{`Deposit ${depositTokenSymbol}`}</h3>
              <button className="wp-modal-close" onClick={() => { setShowDeposit(false); setDepositDebug(null); }}>✕</button>
            </div>
            <div className="wp-modal-balance">
                <span>Wallet native balance</span>
                <strong>{walletEthBalance} ETH</strong>
            </div>
            <label className="wp-modal-label">Amount to deposit</label>
            <div className="wp-modal-input-wrap">
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => { setDepositAmount(e.target.value); setDepositError(""); setDepositStatus(""); setDepositDebug(null); }}
                disabled={depositing}
                autoFocus
              />
                <span className="wp-modal-unit">{depositTokenSymbol}</span>
            </div>
            <div className="wp-modal-presets">
              {depositPresets.map((v) => (
                <button
                  key={v}
                  className={`wp-modal-preset ${depositAmount === v ? "active" : ""}`}
                  onClick={() => { setDepositAmount(v); setDepositError(""); setDepositStatus(""); setDepositDebug(null); }}
                  disabled={depositing}
                  >
                    {`${v} ${depositTokenSymbol}`}
                </button>
              ))}
            </div>
            <div className="wp-modal-precheck" aria-live="polite">
              <span className={`wp-modal-precheck-pill${depositPrecheckUi.isNativeAsset ? " is-native" : ""}${depositPrecheckUi.requiresApproval ? " is-approve" : ""}`}>
                {depositPrecheckBadge}
              </span>
              {depositPrecheckUi.message && (
                <p className="wp-modal-precheck-note">{depositPrecheckUi.message}</p>
              )}
            </div>
            <button
              className="wp-modal-submit"
              onClick={handleDeposit}
              disabled={depositing || !depositAmount || Number(depositAmount) <= 0}
            >
                {depositing ? "Processing..." : `${depositActionLabel} ${depositAmount || "0"} ${depositTokenSymbol}`}
            </button>
            {depositStatus && <p className="wp-modal-success">{depositStatus}</p>}
            {depositError && <p className="wp-modal-error">{depositError}</p>}
            {depositDebug && (
              <details style={{ marginTop: "10px" }}>
                <summary style={{ cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>
                  Debug deposit precheck
                </summary>
                <pre style={{
                  marginTop: "8px",
                  maxHeight: "180px",
                  overflow: "auto",
                  fontSize: "11px",
                  lineHeight: 1.35,
                  color: "#cde2ff",
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  padding: "8px",
                }}>
                  {JSON.stringify(depositDebug, null, 2)}
                </pre>
              </details>
            )}
            <p className="wp-modal-note">Opens MetaMask for confirmation. You pay gas fees.</p>
          </div>
        </div>,
        document.body
      )}

      {/* Withdraw modal */}
      {showWithdraw && createPortal(
        <div className="wp-overlay" onClick={() => setShowWithdraw(false)}>
          <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-head">
              <h3>Withdraw ETH</h3>
              <button className="wp-modal-close" onClick={() => setShowWithdraw(false)}>✕</button>
            </div>
            <div className="wp-modal-balance">
              <span>Vault asset balance</span>
              <strong>{vaultEthBalance} ETH</strong>
            </div>
            <div className="wp-modal-balance">
              <span>Withdraw to</span>
              <strong>{shortAddr(address)}</strong>
            </div>
            <label className="wp-modal-label">Amount to withdraw</label>
            <div className="wp-modal-input-wrap">
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => { setWithdrawAmount(e.target.value); setWithdrawError(""); setWithdrawSuccess(""); }}
                disabled={withdrawing}
                autoFocus
              />
              <span className="wp-modal-unit">ETH</span>
            </div>
            <div className="wp-modal-presets">
              {withdrawPresets.map((v) => (
                <button
                  key={v}
                  className={`wp-modal-preset ${withdrawAmount === v ? "active" : ""}`}
                  onClick={() => { setWithdrawAmount(v); setWithdrawError(""); setWithdrawSuccess(""); }}
                  disabled={withdrawing}
                >
                  {v}
                </button>
              ))}
              <button
                className={`wp-modal-preset ${withdrawAmount === ethBalance ? "active" : ""}`}
                onClick={() => { setWithdrawAmount(vaultEthBalance); setWithdrawError(""); setWithdrawSuccess(""); }}
                disabled={withdrawing}
              >
                Max
              </button>
            </div>
            <button
              className="wp-modal-submit wp-modal-submit-withdraw"
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) <= 0}
            >
              {withdrawing ? "Processing…" : `Withdraw ${withdrawAmount || "0"} ETH`}
            </button>
            {withdrawError && <p className="wp-modal-error">{withdrawError}</p>}
            {withdrawSuccess && <p className="wp-modal-success">{withdrawSuccess}</p>}
            <p className="wp-modal-note">Funds will be sent to your wallet after confirmation.</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}