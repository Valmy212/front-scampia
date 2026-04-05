export const API_BASE = "https://scampia.fexhu.com:20443/api";

async function parseApiResponse(res) {
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

async function apiRequest(path, options = {}) {
  const { method = "GET", body } = options;
  const init = { method, headers: {} };

  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, init);
  return parseApiResponse(res);
}

function normalizeVaultPosition(position) {
  if (!position || typeof position !== "object") return position;

  const principal = position.principal ?? position.principal_amount ?? null;
  const estimatedAssets =
    position.estimatedAssets ??
    position.estimated_assets ??
    position.value ??
    position.position_value ??
    null;

  let profit = position.profit ?? position.pnl ?? null;

  if (profit === null && principal !== null && estimatedAssets !== null) {
    try {
      profit = (BigInt(estimatedAssets) - BigInt(principal)).toString();
    } catch {
      profit = null;
    }
  }

  return {
    ...position,
    vault_id: position.vault_id ?? position.vaultId ?? null,
    user_address: position.user_address ?? position.user ?? null,
    shares: position.shares ?? null,
    principal,
    estimatedAssets,
    estimated_assets: estimatedAssets,
    value: position.value ?? position.position_value ?? estimatedAssets,
    position_value: position.position_value ?? position.value ?? estimatedAssets,
    profit,
    pnl: position.pnl ?? profit,
  };
}

export async function connectWallet(walletAddress) {
  return apiRequest("/v1/users/connect", {
    method: "POST",
    body: { wallet_address: walletAddress },
  });
}

export async function getUser(walletAddress) {
  const res = await fetch(`${API_BASE}/v1/users/${walletAddress}`);
  if (res.status === 404) return null;
  return parseApiResponse(res);
}

export async function getUserVaultSync(walletAddress) {
  const res = await fetch(`${API_BASE}/v1/users/${walletAddress}/vault-sync`);
  if (res.status === 404) return null;
  return parseApiResponse(res);
}

export async function getVaultBalances() {
  return apiRequest("/v1/vaults/balances");
}

export async function getVaultUserPosition(vaultId, userAddress) {
  const payload = await apiRequest(`/v1/vaults/${vaultId}/positions/${userAddress}`);
  return normalizeVaultPosition(payload);
}

export async function buildVaultDeposit(vaultId, amount, receiver) {
  return apiRequest("/v1/vaults/deposit/build", {
    method: "POST",
    body: { vault_id: vaultId, amount, receiver },
  });
}

export async function buildCreateVault(ownerFeeBps) {
  return apiRequest("/v1/vaults/create/build", {
    method: "POST",
    body: { owner_fee_bps: ownerFeeBps },
  });
}

export async function getVaultTokenBalance(tokenAddress) {
  return apiRequest(`/v1/vaults/balance/${tokenAddress}`);
}

export async function listVaults() {
  const payload = await apiRequest("/v1/vaults");
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export async function getVaultStatus(vaultId) {
  return apiRequest(`/v1/vaults/${vaultId}`);
}

export async function getUserInvestments(walletAddress) {
  const payload = await apiRequest(`/v1/users/${walletAddress}/investments`);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export async function buildVaultWithdraw(vaultId, shares, receiver) {
  return apiRequest("/v1/vaults/withdraw/build", {
    method: "POST",
    body: { vault_id: vaultId, shares, receiver },
  });
}

export async function registerVaultEns(payload) {
  return apiRequest("/v1/ens/vaults/register", {
    method: "POST",
    body: payload,
  });
}

export async function updateVaultEnsPolicy(vaultId, payload) {
  return apiRequest(`/v1/ens/vaults/${vaultId}/policy`, {
    method: "PUT",
    body: payload,
  });
}