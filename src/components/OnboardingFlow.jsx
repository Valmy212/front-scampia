import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { connectWallet as apiConnectWallet, getSafeBalances } from "../api";

const TOKENS = [
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "WETH", name: "Wrapped ETH" },
  { symbol: "DAI", name: "Dai" },
  { symbol: "WBTC", name: "Wrapped BTC" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "UNI", name: "Uniswap" },
  { symbol: "ARB", name: "Arbitrum" },
];

function StepIndicator({ number, label, status }) {
  const cls = status === "done" ? "ob-step-done" : status === "active" ? "ob-step-active" : "ob-step-pending";
  return (
    <div className={`ob-step ${cls}`}>
      <div className="ob-step-circle">
        {status === "done" ? "✓" : number}
      </div>
      <span className="ob-step-label">{label}</span>
    </div>
  );
}

export function OnboardingFlow({ wallet, onComplete, onClose }) {
  const { address, loading, error, connect } = wallet;
  const [step, setStep] = useState(address ? 2 : 1);
  const [user, setUser] = useState(null);
  const [balances, setBalances] = useState(null);
  const [safeStatus, setSafeStatus] = useState("");

  const [ensLabel, setEnsLabel] = useState("");
  const [stopLoss, setStopLoss] = useState("50");
  const [stopWin, setStopWin] = useState("50");
  const [maxTradesDaily, setMaxTradesDaily] = useState("10");
  const [ethMinimum, setEthMinimum] = useState("0.01");
  const [maxBuyIn, setMaxBuyIn] = useState("100");
  const [maxDailyLoss, setMaxDailyLoss] = useState("200");
  const [selectedTokens, setSelectedTokens] = useState(["ETH", "USDC"]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    if (!address || step !== 1) return;
    setStep(2);
  }, [address, step]);

  useEffect(() => {
    if (step !== 2 || !address) return;

    setSafeStatus("Création du Safe...");
    apiConnectWallet(address)
      .then((data) => {
        setUser(data);
        setSafeStatus(data.status === "created" ? "Safe déployé !" : "Safe récupéré !");
        return getSafeBalances(data.safe_address).then((bal) => {
          setBalances(bal);
          setTimeout(() => setStep(3), 1200);
        });
      })
      .catch((err) => setSafeStatus("Erreur: " + err.message));
  }, [step, address]);

  const toggleToken = (symbol) => {
    setSelectedTokens((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleSubmitConfig = async () => {
    if (!ensLabel.trim()) {
      setConfigError("Choisis un nom pour ton agent");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(ensLabel)) {
      setConfigError("Seulement lettres minuscules, chiffres et tirets");
      return;
    }
    if (selectedTokens.length === 0) {
      setConfigError("Sélectionne au moins un token");
      return;
    }
    setConfigError("");
    setSubmitting(true);

    try {
      // 1. Créer le sous-nom ENS (le backend attend la confirmation)
      setSubmitStatus("Creating ENS name...");
      const ensRes = await fetch("http://localhost:8000/v1/ens/subnames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_name: "scampia.eth",
          label: ensLabel,
          safe_address: user.safe_address,
        }),
      });
      if (!ensRes.ok) {
        const err = await ensRes.json();
        throw new Error(err.detail || "ENS creation failed");
      }

      // 2. Lier l'adresse au nom ENS
      setSubmitStatus("Setting ENS records...");
      const recordsRes = await fetch("http://localhost:8000/v1/ens/records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${ensLabel}.scampia.eth`,
          address: user.safe_address,
        }),
      });
      if (!recordsRes.ok) {
        const err = await recordsRes.json();
        throw new Error(err.detail || "ENS records failed");
      }

      console.log("User preferences:", {
        wallet: address,
        safe: user.safe_address,
        ensName: `${ensLabel}.scampia.eth`,
        stopLoss: stopLoss + "%",
        stopWin: stopWin + "%",
        maxTradesDaily,
        ethMinimum: ethMinimum + " ETH",
        maxBuyIn: maxBuyIn + " USD",
        maxDailyLoss: maxDailyLoss + " USD",
        tokens: selectedTokens,
      });

      if (onComplete) {
        onComplete({
          user,
          balances,
          ensName: `${ensLabel}.scampia.eth`,
        });
      }
    } catch (err) {
      setConfigError(err.message);
      setSubmitStatus("");
    } finally {
      setSubmitting(false);
    }
  };

  const stepStatus = (n) => {
    if (step > n) return "done";
    if (step === n) return "active";
    return "pending";
  };

  return createPortal(
    <div className="ob-overlay" onClick={onClose}>
      <div className="ob-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ob-modal-header">
          <h2 className="ob-title">Setup your agent</h2>
          <button className="ob-close" onClick={onClose}>✕</button>
        </div>

        <div className="ob-steps">
          <StepIndicator number={1} label="Connect Wallet" status={stepStatus(1)} />
          <div className="ob-step-line" />
          <StepIndicator number={2} label="Create Safe" status={stepStatus(2)} />
          <div className="ob-step-line" />
          <StepIndicator number={3} label="Configure" status={stepStatus(3)} />
        </div>

        {step === 1 && (
          <div className="ob-content">
            {window.ethereum ? (
              <>
                <p className="ob-description">Connect your MetaMask wallet to get started.</p>
                <button className="ob-btn-primary" onClick={connect} disabled={loading}>
                  {loading ? "Connecting..." : "Connect MetaMask"}
                </button>
                {error && <p className="ob-error">{error}</p>}
              </>
            ) : (
              <>
                <p className="ob-description">You need MetaMask to use ScampIA.</p>
                <a
                  className="ob-btn-primary"
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ textAlign: "center", textDecoration: "none", display: "block" }}
                >
                  Install MetaMask
                </a>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="ob-content">
            <div className="ob-loading">
              <div className="ob-spinner" />
              <p>{safeStatus}</p>
                {safeStatus.startsWith("Erreur") && (
                <button className="ob-btn-primary" onClick={() => { setStep(2); setSafeStatus(""); }}>
                    Réessayer
                </button>
                )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="ob-content">
            <div className="ob-field">
              <label>Agent name</label>
              <div className="ob-ens-input">
                <input
                  type="text"
                  placeholder="myagent"
                  value={ensLabel}
                  onChange={(e) => setEnsLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  disabled={submitting}
                />
                <span className="ob-ens-suffix">.scampia.eth</span>
              </div>
            </div>

            <div className="ob-section-label">Risk Management</div>

            <div className="ob-row">
              <div className="ob-field">
                <label>Stop Loss</label>
                <div className="ob-input-unit">
                  <input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    disabled={submitting}
                    placeholder="50"
                  />
                  <span>%</span>
                </div>
                <span className="ob-hint">Arrête si le portefeuille perd ce %</span>
              </div>
              <div className="ob-field">
                <label>Stop Win</label>
                <div className="ob-input-unit">
                  <input
                    type="number"
                    value={stopWin}
                    onChange={(e) => setStopWin(e.target.value)}
                    disabled={submitting}
                    placeholder="50"
                  />
                  <span>%</span>
                </div>
                <span className="ob-hint">Arrête si le portefeuille gagne ce %</span>
              </div>
            </div>

            <div className="ob-row">
              <div className="ob-field">
                <label>Max buy-in per trade</label>
                <div className="ob-input-unit">
                  <input
                    type="number"
                    value={maxBuyIn}
                    onChange={(e) => setMaxBuyIn(e.target.value)}
                    disabled={submitting}
                    placeholder="100"
                  />
                  <span>USD</span>
                </div>
              </div>
              <div className="ob-field">
                <label>Max daily loss</label>
                <div className="ob-input-unit">
                  <input
                    type="number"
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(e.target.value)}
                    disabled={submitting}
                    placeholder="200"
                  />
                  <span>USD</span>
                </div>
              </div>
            </div>

            <div className="ob-section-label">Limits</div>

            <div className="ob-row">
              <div className="ob-field">
                <label>Max trades per day</label>
                <input
                  type="number"
                  value={maxTradesDaily}
                  onChange={(e) => setMaxTradesDaily(e.target.value)}
                  disabled={submitting}
                  placeholder="10"
                />
              </div>
              <div className="ob-field">
                <label>ETH minimum to keep</label>
                <div className="ob-input-unit">
                  <input
                    type="number"
                    step="0.001"
                    value={ethMinimum}
                    onChange={(e) => setEthMinimum(e.target.value)}
                    disabled={submitting}
                    placeholder="0.01"
                  />
                  <span>ETH</span>
                </div>
                <span className="ob-hint">Réserve ETH pour le gas</span>
              </div>
            </div>

            <div className="ob-field">
              <label>Tokens to trade</label>
              <div className="ob-currencies">
                {TOKENS.map((t) => (
                  <button
                    key={t.symbol}
                    type="button"
                    className={`ob-currency-chip ${selectedTokens.includes(t.symbol) ? "ob-currency-active" : ""}`}
                    onClick={() => toggleToken(t.symbol)}
                    disabled={submitting}
                  >
                    {t.symbol}
                  </button>
                ))}
              </div>
            </div>

            {configError && <p className="ob-error">{configError}</p>}
            {submitStatus && !configError && <p className="ob-description">{submitStatus}</p>}

            <button className="ob-btn-primary" onClick={handleSubmitConfig} disabled={submitting}>
              {submitting ? submitStatus || "Setting up..." : "Launch Agent"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}