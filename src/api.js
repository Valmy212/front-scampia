const API_BASE = "http://localhost:8000";

export async function connectWallet(walletAddress) {
  const res = await fetch(`${API_BASE}/v1/users/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getUser(walletAddress) {
  const res = await fetch(`${API_BASE}/v1/users/${walletAddress}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSafeBalances(safeAddress) {
  const res = await fetch(`${API_BASE}/v1/safes/${safeAddress}/balances`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSafeOwners(safeAddress) {
  const res = await fetch(`${API_BASE}/v1/safes/${safeAddress}/owners`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function withdrawEth(safeAddress, to, amount) {
  const res = await fetch(`${API_BASE}/v1/safes/withdraw/eth/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ safe_address: safeAddress, to, amount }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}