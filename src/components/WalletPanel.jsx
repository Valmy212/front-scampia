import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "../useWallet";
import { getUser, getSafeBalances, withdrawEth } from "../api";
import { OnboardingFlow } from "./OnboardingFlow";

function shortAddr(addr) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function formatBal(balance, decimals) {
  return (balance / 10 ** decimals).toFixed(4);
}

function weiFromEth(eth) {
  return String(Math.floor(Number(eth) * 1e18));
}

export function WalletPanel() {
  const wallet = useWallet();
  const { address, disconnect, depositEth, autoChecked } = wallet;

  const [user, setUser] = useState(null);
  const [balances, setBalances] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [checking, setChecking] = useState(false);

  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState("");

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");

  const dropdownRef = useRef(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!address || !autoChecked || checkedRef.current) return;
    checkedRef.current = true;
    setChecking(true);

    getUser(address)
      .then((userData) => {
        if (userData && userData.safe_address) {
          setUser(userData);
          setOnboarded(true);
          return getSafeBalances(userData.safe_address).then((bal) => setBalances(bal));
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

  const refreshBalances = async () => {
    if (!user) return;
    const bal = await getSafeBalances(user.safe_address);
    setBalances(bal);
  };

  // Deposit

  const handleDeposit = async () => {
    if (!user || !depositAmount || Number(depositAmount) <= 0) return;
    setDepositing(true);
    setDepositError("");
    try {
      await depositEth(user.safe_address, depositAmount);
      setShowDeposit(false);
      setDepositAmount("");
      setTimeout(refreshBalances, 6000);
    } catch (err) {
      if (err.message.includes("INSUFFICIENT_FUNDS") || err.message.includes("insufficient funds")) {
        setDepositError("Solde MetaMask insuffisant. Ajoute du ETH sur ton wallet.");
      } else if (err.message.includes("user rejected") || err.message.includes("ACTION_REJECTED")) {
        setDepositError("Transaction annulée.");
      } else {
        setDepositError("Erreur: " + err.message);
      }
    } finally {
      setDepositing(false);
    }
  };

  // Withdraw

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount || Number(withdrawAmount) <= 0) return;
    setWithdrawing(true);
    setWithdrawError("");
    setWithdrawSuccess("");
    try {
      const result = await withdrawEth(
        user.safe_address,
        address,
        weiFromEth(withdrawAmount)
      );
      setWithdrawSuccess("Retrait effectué ! Tx: " + shortAddr(result.txHash));
      setWithdrawAmount("");
      setTimeout(refreshBalances, 3000);
    } catch (err) {
      const msg = err.message;
      if (msg.includes("insufficient") || msg.includes("tried to withdraw")) {
        setWithdrawError("Solde du Safe insuffisant.");
      } else {
        setWithdrawError("Erreur: " + msg);
      }
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setUser(null);
    setBalances(null);
    setDropdownOpen(false);
    setOnboarded(false);
    checkedRef.current = false;
  };

  const handleOnboardingComplete = (config) => {
    console.log("Agent configured:", config);
    setUser(config.user);
    setBalances(config.balances);
    setShowOnboarding(false);
    setOnboarded(true);
  };

  const ethBalance = balances?.ETH ? formatBal(balances.ETH.balance, 18) : "0";
  const depositPresets = ["0.001", "0.005", "0.01", "0.05"];
  const withdrawPresets = ["0.001", "0.005", "0.01"];

  if (checking) {
    return (
      <div style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
        Loading…
      </div>
    );
  }

  if (!address || !onboarded) {
    return (
      <>
        <button
          className="cta-button cta-button-small"
          onClick={() => setShowOnboarding(true)}
          style={{ marginLeft: "auto", whiteSpace: "nowrap" }}
        >
          Connect Wallet
        </button>
        {showOnboarding && (
          <OnboardingFlow
            wallet={wallet}
            onComplete={handleOnboardingComplete}
            onClose={() => setShowOnboarding(false)}
          />
        )}
      </>
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
                <div className="wp-dd-label">Safe</div>
                <div className="wp-dd-value">{shortAddr(user.safe_address)}</div>
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
              <button className="wp-dd-btn wp-dd-btn-primary" onClick={() => { setShowDeposit(true); setDropdownOpen(false); setDepositError(""); }}>
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
              <span>Safe balance</span>
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
                onChange={(e) => { setDepositAmount(e.target.value); setDepositError(""); }}
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
                  onClick={() => { setDepositAmount(v); setDepositError(""); }}
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
              {depositing ? "Confirm in MetaMask…" : `Deposit ${depositAmount || "0"} ETH`}
            </button>
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
              <span>Safe balance</span>
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
            <p className="wp-modal-note">Funds will be sent to your wallet. Backend pays gas fees.</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}