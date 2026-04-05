import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  API_BASE,
  connectWallet as apiConnectWallet,
  getVaultBalances,
  buildCreateVault,
} from "../api";

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
  const { address, loading, error, connect, sendBuiltTransaction } = wallet;
  const [step, setStep] = useState(address ? 2 : 1);
  const [user, setUser] = useState(null);
  const [balances, setBalances] = useState(null);
  const [vaultStatus, setVaultStatus] = useState("");
  const deployingRef = useRef(false);

  const [onboardingMode, setOnboardingMode] = useState("owner");
  const [ownerFeeBps, setOwnerFeeBps] = useState("300");
  const [targetVaultId, setTargetVaultId] = useState("");

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

  function getVaultId(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.vault_id !== undefined && payload.vault_id !== null) return payload.vault_id;
    if (payload.vaultId !== undefined && payload.vaultId !== null) return payload.vaultId;
    return null;
  }

  function extractTxPayload(response) {
    if (!response || typeof response !== "object") return null;
    if (response.tx && typeof response.tx === "object") return response.tx;
    if (response.transaction && typeof response.transaction === "object") return response.transaction;
    if (response.txData && typeof response.txData === "object") return response.txData;
    if (response.to && response.data) return response;
    return null;
  }

  const toggleToken = (symbol) => {
    setSelectedTokens((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleRetry = () => {
    deployingRef.current = false;
    setVaultStatus("");
    setStep(2);
  };

  const handleOwnerCreateVault = async () => {
    if (!address || deployingRef.current) return;

    const feeBps = Number(ownerFeeBps);
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5000) {
      setVaultStatus("Error: owner fee must be between 0 and 5000 bps.");
      return;
    }

    deployingRef.current = true;
    setVaultStatus("Preparing vault creation...");

    try {
      const buildRes = await buildCreateVault(feeBps);
      const txPayload = extractTxPayload(buildRes);
      if (!txPayload) {
        throw new Error("Create transaction not returned by backend");
      }

      setVaultStatus("Sign transaction in MetaMask...");
      const tx = await sendBuiltTransaction(txPayload);
      if (tx && typeof tx.wait === "function") {
        setVaultStatus("Waiting for on-chain confirmation...");
        await tx.wait();
      }

      setVaultStatus("Syncing user profile...");
      const userData = await apiConnectWallet(address);
      const attachedVaultId = getVaultId(userData);
      if (attachedVaultId === null) {
        throw new Error("Vault created but no vault_id returned during user sync");
      }

      const bal = await getVaultBalances();
      setUser(userData);
      setBalances(bal);
      setVaultStatus("Vault created and attached.");
      setTimeout(() => setStep(3), 700);
    } catch (err) {
      setVaultStatus("Error: " + err.message);
      deployingRef.current = false;
      return;
    }

    deployingRef.current = false;
  };

  const handleJoinExistingVault = async () => {
    if (!address || deployingRef.current) return;

    const parsedVaultId = Number(targetVaultId);
    if (!Number.isInteger(parsedVaultId) || parsedVaultId < 0) {
      setVaultStatus("Error: invalid vault id.");
      return;
    }

    deployingRef.current = true;
    setVaultStatus("Attaching vault...");

    try {
      const userData = await apiConnectWallet(address);
      const mergedUser = {
        ...(userData || {}),
        wallet_address: address,
        vault_id: parsedVaultId,
      };

      const bal = await getVaultBalances();
      setUser(mergedUser);
      setBalances(bal);
      setVaultStatus(`Ready: vault #${parsedVaultId} attached. You can deposit tokens now.`);

      if (onComplete) {
        onComplete({ user: mergedUser, balances: bal });
      }
    } catch (err) {
      setVaultStatus("Error: " + err.message);
      deployingRef.current = false;
      return;
    }

    deployingRef.current = false;
  };

  const handleSubmitConfig = async () => {
    if (!ensLabel.trim()) {
      setConfigError("Choose a name for your agent");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(ensLabel)) {
      setConfigError("Use only lowercase letters, numbers, and dashes");
      return;
    }
    if (selectedTokens.length === 0) {
      setConfigError("Select at least one token");
      return;
    }
    setConfigError("");
    setSubmitting(true);

    try {
      // 1. Create ENS subname (backend expects confirmation)
      setSubmitStatus("Creating ENS name...");
      const ensRes = await fetch(`${API_BASE}/v1/ens/subnames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_name: "scampia.eth",
          label: ensLabel,
          safe_address: user.safe_address || user.vault_address,
        }),
      });
      if (!ensRes.ok) {
        const err = await ensRes.json();
        throw new Error(err.detail || "ENS creation failed");
      }

      // 2. Link the address to ENS name
      setSubmitStatus("Setting ENS records...");
      const recordsRes = await fetch(`${API_BASE}/v1/ens/records`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${ensLabel}.scampia.eth`,
          address: user.safe_address || user.vault_address,
        }),
      });
      if (!recordsRes.ok) {
        const err = await recordsRes.json();
        throw new Error(err.detail || "ENS records failed");
      }

      console.log("User preferences:", {
        wallet: address,
        vault: user.vault_id ?? user.vaultId,
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
          <StepIndicator number={2} label="Attach Vault" status={stepStatus(2)} />
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
            <div className="ob-field">
              <label>Role</label>
              <div className="ob-currencies">
                <button
                  type="button"
                  className={`ob-currency-chip ${onboardingMode === "owner" ? "ob-currency-active" : ""}`}
                  disabled={deployingRef.current}
                  onClick={() => {
                    setOnboardingMode("owner");
                    setVaultStatus("");
                  }}
                >
                  Owner (create vault)
                </button>
                <button
                  type="button"
                  className={`ob-currency-chip ${onboardingMode === "user" ? "ob-currency-active" : ""}`}
                  disabled={deployingRef.current}
                  onClick={() => {
                    setOnboardingMode("user");
                    setVaultStatus("");
                  }}
                >
                  User (deposit tokens)
                </button>
              </div>
            </div>

            {onboardingMode === "owner" ? (
              <>
                <div className="ob-field">
                  <label>Owner fee (bps)</label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    step="1"
                    value={ownerFeeBps}
                    onChange={(e) => setOwnerFeeBps(e.target.value)}
                    disabled={deployingRef.current}
                    placeholder="300"
                  />
                </div>
                <button className="ob-btn-primary" onClick={handleOwnerCreateVault} disabled={deployingRef.current}>
                  {deployingRef.current ? "Processing..." : "Create Vault"}
                </button>
              </>
            ) : (
              <>
                <div className="ob-field">
                  <label>Vault ID to join</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={targetVaultId}
                    onChange={(e) => setTargetVaultId(e.target.value)}
                    disabled={deployingRef.current}
                    placeholder="0"
                  />
                    <span className="ob-hint">Use the vault_id shared by the owner</span>
                </div>
                <button className="ob-btn-primary" onClick={handleJoinExistingVault} disabled={deployingRef.current}>
                  {deployingRef.current ? "Processing..." : "Attach Vault and Continue"}
                </button>
              </>
            )}

            {!!vaultStatus && <p className={vaultStatus.startsWith("Error") ? "ob-error" : "ob-description"}>{vaultStatus}</p>}
            {vaultStatus.startsWith("Error") && (
              <button className="ob-btn-primary" onClick={handleRetry}>
                Reset Step
              </button>
            )}
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
                <span className="ob-hint">Stop if the portfolio loses this %</span>
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
                <span className="ob-hint">Stop if the portfolio gains this %</span>
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
                <span className="ob-hint">Reserve ETH for gas fees</span>
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