export function ConnectButton({ onConnect, loading, error }) {
  return (
    <div className="wallet-connect">
      <button className="cta-button cta-button-small" onClick={onConnect} disabled={loading}>
        {loading ? "Connexion..." : "Connect Wallet"}
      </button>
      {error && <p className="wallet-error">{error}</p>}
    </div>
  );
}