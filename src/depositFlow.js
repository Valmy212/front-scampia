import { BrowserProvider, Contract, MaxUint256, isAddress, parseUnits } from 'ethers';

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export function extractTxPayload(response) {
  if (!response || typeof response !== 'object') return null;
  if (response.tx && typeof response.tx === 'object') return response.tx;
  if (response.transaction && typeof response.transaction === 'object') return response.transaction;
  if (response.txData && typeof response.txData === 'object') return response.txData;
  if (response.to && response.data) return response;
  return null;
}

export function isUserRejectedError(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === 4001 || message.includes('user rejected') || message.includes('rejected the request') || message.includes('action_rejected');
}

function resolveVaultTokenAddress(vaultStatus, selectedVault) {
  const candidates = [
    vaultStatus?.asset_token,
    vaultStatus?.assetToken,
    vaultStatus?.token,
    vaultStatus?.token_address,
    selectedVault?.asset_token,
    selectedVault?.assetToken,
    selectedVault?.token,
    selectedVault?.token_address,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isAddress(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveVaultSpenderAddress(vaultStatus, selectedVault, txPayload) {
  const candidates = [
    vaultStatus?.vault_address,
    vaultStatus?.vaultAddress,
    vaultStatus?.address,
    vaultStatus?.contract_address,
    selectedVault?.vault_address,
    selectedVault?.vaultAddress,
    selectedVault?.address,
    selectedVault?.contract_address,
    txPayload?.to,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isAddress(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function ensureChainForTx(txPayload) {
  const chainIdRaw = txPayload?.chainId ?? txPayload?.chain_id;
  if (!chainIdRaw || !window.ethereum) return;
  const hexChainId = typeof chainIdRaw === 'number' ? `0x${chainIdRaw.toString(16)}` : chainIdRaw;
  if (!hexChainId) return;

  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: hexChainId }],
  });
}

export async function executeVaultDepositFlow({
  address,
  vaultId,
  amountUi,
  selectedVault = null,
  getVaultStatusFn,
  buildVaultDepositFn,
  sendBuiltTransactionFn,
  onStatus,
}) {
  if (!window.ethereum) {
    throw new Error('MetaMask non detecte.');
  }

  onStatus('Checking...');

  const vaultStatusData = await getVaultStatusFn(vaultId).catch(() => null);
  const tokenAddress = resolveVaultTokenAddress(vaultStatusData, selectedVault);
  if (!tokenAddress) {
    throw new Error('Token address not found for this vault.');
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

  let decimals;
  try {
    decimals = Number(await tokenContract.decimals());
  } catch {
    throw new Error('Unable to read token decimals.');
  }

  let amountRaw;
  try {
    amountRaw = parseUnits(amountUi, decimals);
  } catch {
    throw new Error('Invalid amount or token decimals mismatch.');
  }

  if (amountRaw <= 0n) {
    throw new Error('Invalid amount');
  }

  const buildRes = await buildVaultDepositFn(vaultId, amountRaw.toString(), address);
  const txPayload = extractTxPayload(buildRes);
  if (!txPayload) {
    throw new Error('Deposit transaction missing in backend response');
  }

  const vaultSpender = resolveVaultSpenderAddress(vaultStatusData, selectedVault, txPayload);
  if (!vaultSpender) {
    throw new Error('Vault spender address not found for allowance check.');
  }

  const [ownerBalance, currentAllowance] = await Promise.all([
    tokenContract.balanceOf(address),
    tokenContract.allowance(address, vaultSpender),
  ]);

  if (ownerBalance < amountRaw) {
    throw new Error('Solde insuffisant');
  }

  if (currentAllowance < amountRaw) {
    onStatus('Approving...');

    try {
      const approveTx = await tokenContract.approve(vaultSpender, MaxUint256);
      await approveTx.wait();
    } catch (approveErr) {
      if (isUserRejectedError(approveErr)) {
        throw new Error('Approve refuse par l utilisateur.');
      }

      const resetTx = await tokenContract.approve(vaultSpender, 0n);
      await resetTx.wait();

      const secondApproveTx = await tokenContract.approve(vaultSpender, MaxUint256);
      await secondApproveTx.wait();
    }

    const allowanceAfterApprove = await tokenContract.allowance(address, vaultSpender);
    if (allowanceAfterApprove < amountRaw) {
      throw new Error('Allowance insuffisante apres approve.');
    }
  }

  await ensureChainForTx(txPayload);
  await signer.estimateGas({
    to: txPayload.to,
    data: txPayload.data,
    value: txPayload.value ?? '0',
  });

  onStatus('Depositing...');
  return sendBuiltTransactionFn(txPayload);
}
