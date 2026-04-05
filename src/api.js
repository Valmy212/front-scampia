export const API_BASE = "https://scampia.fexhu.com:20443/api";

async function parseApiResponse(res) {
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function connectWallet(walletAddress) {
  const res = await fetch(`${API_BASE}/v1/users/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
  return parseApiResponse(res);
}

export async function getUser(walletAddress) {
  const res = await fetch(`${API_BASE}/v1/users/${walletAddress}`);
  if (res.status === 404) return null;
  return parseApiResponse(res);
}

export async function getVaultBalances() {
  const res = await fetch(`${API_BASE}/v1/vaults/balances`);
  return parseApiResponse(res);
}

export async function getVaultUserPosition(vaultId, userAddress) {
  const res = await fetch(`${API_BASE}/v1/vaults/${vaultId}/positions/${userAddress}`);
  return parseApiResponse(res);
}

export async function buildVaultDeposit(vaultId, amount, receiver) {
  const res = await fetch(`${API_BASE}/v1/vaults/deposit/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vault_id: vaultId, amount, receiver }),
  });
  return parseApiResponse(res);
}

export async function buildCreateVault(ownerFeeBps) {
  const res = await fetch(`${API_BASE}/v1/vaults/create/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner_fee_bps: ownerFeeBps }),
  });
  return parseApiResponse(res);
}

export async function getVaultTokenBalance(tokenAddress) {
  const res = await fetch(`${API_BASE}/v1/vaults/balance/${tokenAddress}`);
  return parseApiResponse(res);
}

export async function listVaults() {
  // TODO(back): expose GET /v1/vaults returning vault metadata list (vault_id, owner, asset, total_assets, total_shares).
  const res = await fetch(`${API_BASE}/v1/vaults`);
  if (res.status === 404) return [];
  return parseApiResponse(res);
}

export async function getVaultStatus(vaultId) {
  // TODO(back): expose GET /v1/vaults/{vault_id} with aggregated vault metrics for dashboard status page.
  const res = await fetch(`${API_BASE}/v1/vaults/${vaultId}`);
  if (res.status === 404) return null;
  return parseApiResponse(res);
}

export async function buildVaultWithdraw(vaultId, shares, receiver) {
  const res = await fetch(`${API_BASE}/v1/vaults/withdraw/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vault_id: vaultId, shares, receiver }),
  });
  return parseApiResponse(res);
}