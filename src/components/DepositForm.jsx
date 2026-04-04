import { useState } from "react";

export function DepositForm({ onDeposit, onClose, balances }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await onDeposit(amount);
    } finally {
      setLoading(false);
    }
  };

  const presets = ["0.001", "0.005", "0.01", "0.05"];

  return (
    <div className="deposit-overlay" onClick={onClose}>
      <div className="deposit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="deposit-header">
          <h3>Deposit ETH</h3>
          <button className="deposit-close" onClick={onClose}>✕</button>
        </div>

        {balances && (
          <div className="deposit-current-balance">
            <span>Current Safe balance</span>
            <strong>
              {balances.ETH
                ? (balances.ETH.balance / 10 ** 18).toFixed(6) + " ETH"
                : "0 ETH"}
            </strong>
          </div>
        )}

        <div className="deposit-input-group">
          <label>Amount to deposit</label>
          <div className="deposit-input-wrap">
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <span className="deposit-input-unit">ETH</span>
          </div>
        </div>

        <div className="deposit-presets">
          {presets.map((val) => (
            <button
              key={val}
              type="button"
              className={`deposit-preset${amount === val ? " deposit-preset-active" : ""}`}
              onClick={() => setAmount(val)}
              disabled={loading}
            >
              {val} ETH
            </button>
          ))}
        </div>

        <button
          className="cta-button deposit-submit"
          onClick={handleSubmit}
          disabled={loading || !amount || Number(amount) <= 0}
        >
          {loading ? "Confirming in MetaMask..." : `Deposit ${amount || "0"} ETH`}
        </button>

        <p className="deposit-note">
          This will open MetaMask to confirm the transaction. You pay the gas fees.
        </p>
      </div>
    </div>
  );
}