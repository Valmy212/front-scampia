function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatBalance(balance, decimals) {
  return (balance / 10 ** decimals).toFixed(6);
}

export function SafeInfo({ address, safeAddress, balances, status, onDisconnect }) {
  return (
    <div className="wallet-connected">
      <div className="wallet-addresses">
        <span className="wallet-dot" />
        <span className="wallet-addr">{shortAddr(address)}</span>
        {safeAddress && (
          <>
            <span className="wallet-separator">|</span>
            <span className="wallet-safe-label">Safe</span>
            <span className="wallet-addr">{shortAddr(safeAddress)}</span>
          </>
        )}
      </div>

      {balances && (
        <div className="wallet-balances">
          {Object.entries(balances).map(([symbol, info]) => (
            <span key={symbol} className="wallet-balance-item">
              {formatBalance(info.balance, info.decimals)} {symbol}
            </span>
          ))}
        </div>
      )}

      {status && status !== "Connecté" && (
        <span className="wallet-status">{status}</span>
      )}

      {onDisconnect && (
        <button className="wallet-disconnect" onClick={onDisconnect} title="Déconnecter">
          ✕
        </button>
      )}
    </div>
  );
}