import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "../useWallet";
import { executeVaultDepositFlow, extractTxPayload, isUserRejectedError } from "../depositFlow";
import {
  getUser,
  getVaultBalances,
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


export function WalletPanel() {
  const wallet = useWallet();
  const { address, loading, error: walletError, connect, disconnect, sendBuiltTransaction, autoChecked } = wallet;

  const [user, setUser] = useState(null);
  const [balances, setBalances] = useState(null);
  const [position, setPosition] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [checking, setChecking] = useState(false);

  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [depositStatus, setDepositStatus] = useState("");

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");

  const dropdownRef = useRef(null);
  const checkedRef = useRef(false);

  const refreshBalances = async (userData = user) => {
    if (!userData || !address) return;

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

    getUser(address)
      .then((userData) => {
        if (getVaultId(userData) !== null) {
          setUser(userData);
          setOnboarded(true);
          return refreshBalances(userData);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [address, autoChecked]);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Deposit

  const handleDeposit = async () => {
    const vaultId = getVaultId(user);
    if (vaultId === null || !depositAmount || Number(depositAmount) <= 0) return;

    setDepositing(true);
    setDepositError("");
    setDepositStatus("");
    try {
      const tx = await executeVaultDepositFlow({
        address,
        vaultId,
        amountUi: depositAmount,
        getVaultStatusFn: getVaultStatus,
        buildVaultDepositFn: buildVaultDeposit,
        sendBuiltTransactionFn: sendBuiltTransaction,
        onStatus: setDepositStatus,
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
      const userData = await getUser(connectedAddress).catch(() => null);
      if (getVaultId(userData) !== null) {
        setUser(userData);
        setOnboarded(true);
        await refreshBalances(userData);
      }
    } finally {
      setChecking(false);
    }
  };

  const ethBalance = balances?.ETH
    ? formatBal(balances.ETH.balance, Number(balances.ETH.decimals ?? 18))
    : "0";
  const userShares = position?.shares ?? position?.user_shares;
  const depositPresets = ["0.001", "0.005", "0.01", "0.05"];
  const withdrawPresets = ["0.001", "0.005", "0.01"];

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
      <div className="wp" ref={dropdownRef}>
        <button className="wp-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
          <span className="wp-dot" />
          <span className="wp-addr">{shortAddr(address)}</span>
          <span className="wp-bal">{ethBalance} ETH</span>
          <span className={`wp-chevron ${dropdownOpen ? "wp-chevron-open" : ""}`}>▾</span>
        </button>

        {dropdownOpen && (
          <div className="wp-dropdown">
            <div className="wp-dd-section">
              <div className="wp-dd-label">Wallet</div>
              <div className="wp-dd-value">{shortAddr(address)}</div>
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
              <button className="wp-dd-btn wp-dd-btn-primary" onClick={() => { setShowDeposit(true); setDropdownOpen(false); setDepositError(""); setDepositStatus(""); }}>
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

      {/* Deposit modal */}
      {showDeposit && createPortal(
        <div className="wp-overlay" onClick={() => setShowDeposit(false)}>
          <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-head">
              <h3>Deposit ETH</h3>
              <button className="wp-modal-close" onClick={() => setShowDeposit(false)}>✕</button>
            </div>
            <div className="wp-modal-balance">
              <span>Vault asset balance</span>
              <strong>{ethBalance} ETH</strong>
            </div>
            <label className="wp-modal-label">Amount to deposit</label>
            <div className="wp-modal-input-wrap">
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => { setDepositAmount(e.target.value); setDepositError(""); setDepositStatus(""); }}
                disabled={depositing}
                autoFocus
              />
              <span className="wp-modal-unit">ETH</span>
            </div>
            <div className="wp-modal-presets">
              {depositPresets.map((v) => (
                <button
                  key={v}
                  className={`wp-modal-preset ${depositAmount === v ? "active" : ""}`}
                  onClick={() => { setDepositAmount(v); setDepositError(""); setDepositStatus(""); }}
                  disabled={depositing}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              className="wp-modal-submit"
              onClick={handleDeposit}
              disabled={depositing || !depositAmount || Number(depositAmount) <= 0}
            >
              {depositing ? "Processing..." : `Deposit ${depositAmount || "0"} ETH`}
            </button>
            {depositStatus && <p className="wp-modal-success">{depositStatus}</p>}
            {depositError && <p className="wp-modal-error">{depositError}</p>}
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
              <strong>{ethBalance} ETH</strong>
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
                onClick={() => { setWithdrawAmount(ethBalance); setWithdrawError(""); setWithdrawSuccess(""); }}
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