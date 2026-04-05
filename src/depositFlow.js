import { BrowserProvider, Contract, MaxUint256, isAddress, parseUnits } from 'ethers';

const REQUEST_TIMEOUT_MS = 20000;

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export function extractTxPayload(response) {
  if (!response || typeof response !== 'object') return null;

  let payload = null;
  if (response.tx && typeof response.tx === 'object') payload = response.tx;
  else if (response.transaction && typeof response.transaction === 'object') payload = response.transaction;
  else if (response.txData && typeof response.txData === 'object') payload = response.txData;
  else if (response.to && response.data) payload = response;

  if (!payload) return null;

  const fallbackValue = toNormalizedTxValue(
    response.value ?? response.tx_value ?? response.txValue,
  );
  if ((payload.value === null || payload.value === undefined) && fallbackValue !== null) {
    return {
      ...payload,
      value: fallbackValue,
    };
  }

  return payload;
}

export function isUserRejectedError(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === 4001 || message.includes('user rejected') || message.includes('rejected the request') || message.includes('action_rejected');
}

function withTimeout(promise, timeoutMessage, timeoutMs = REQUEST_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

function toBigIntOrNull(value) {
  if (value === null || value === undefined) return null;
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNormalizedTxValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.trunc(value).toString();
  }
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return null;
}

function getPrecheckAddress(precheck, keys) {
  for (const key of keys) {
    const value = precheck?.[key];
    if (typeof value === 'string' && isAddress(value)) {
      return value;
    }
  }
  return null;
}

export function normalizePrecheckPayload(precheck) {
  if (!precheck || typeof precheck !== 'object') return null;

  const tokenAddress = getPrecheckAddress(precheck, [
    'assetToken',
    'asset_token',
    'token_address',
    'token',
  ]);

  const spenderAddress = getPrecheckAddress(precheck, [
    'spender',
    'spenderAddress',
    'spender_address',
    'vault_address',
    'vault',
  ]);

  const decimals = toNumberOrNull(
    precheck.assetDecimals ??
    precheck.asset_decimals ??
    precheck.decimals ??
    precheck.token_decimals,
  );

  const assetSymbolRaw =
    precheck.assetSymbol ??
    precheck.asset_symbol ??
    precheck.tokenSymbol ??
    precheck.token_symbol ??
    precheck.symbol ??
    null;

  const assetSymbol =
    typeof assetSymbolRaw === 'string' && assetSymbolRaw.trim().length > 0
      ? assetSymbolRaw.trim().toUpperCase()
      : null;

  const balance = toBigIntOrNull(
    precheck.balance ??
    precheck.ownerBalance ??
    precheck.owner_balance ??
    precheck.wallet_balance,
  );

  const allowance = toBigIntOrNull(
    precheck.allowance ??
    precheck.current_allowance,
  );

  const allowanceSufficient =
    precheck.allowanceSufficient ??
    precheck.allowance_sufficient ??
    null;

  const canDeposit =
    precheck.can_deposit ??
    precheck.deposit_allowed ??
    precheck.allowed ??
    null;

  const needsApproval =
    precheck.needs_approval ??
    precheck.require_approval ??
    precheck.requires_approval ??
    null;

  const requiresApproval =
    precheck.requiresApproval ??
    precheck.requires_approval ??
    precheck.require_approval ??
    precheck.needs_approval ??
    null;

  const isNativeAsset =
    precheck.isNativeAsset ??
    precheck.is_native_asset ??
    precheck.native_asset ??
    precheck.native ??
    null;

  const message =
    precheck.message ??
    precheck.reason ??
    precheck.error ??
    null;

  return {
    tokenAddress,
    spenderAddress,
    assetSymbol,
    decimals,
    balance,
    allowance,
    canDeposit: typeof canDeposit === 'boolean' ? canDeposit : null,
    needsApproval: typeof needsApproval === 'boolean' ? needsApproval : null,
    requiresApproval: typeof requiresApproval === 'boolean' ? requiresApproval : null,
    isNativeAsset: typeof isNativeAsset === 'boolean' ? isNativeAsset : null,
    allowanceSufficient: typeof allowanceSufficient === 'boolean' ? allowanceSufficient : null,
    message: typeof message === 'string' ? message : null,
    raw: precheck,
  };
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

function isNativeLikeAddress(address) {
  if (typeof address !== 'string') return false;
  const normalized = address.toLowerCase();
  return (
    normalized === '0x0000000000000000000000000000000000000000' ||
    normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  );
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
  getVaultDepositPrecheckFn,
  buildVaultDepositFn,
  sendBuiltTransactionFn,
  onStatus,
  onDebug,
  onPrecheck,
}) {
  if (!window.ethereum) {
    throw new Error('MetaMask non detecte.');
  }

  onStatus('Checking...');

  const vaultStatusData = await withTimeout(
    getVaultStatusFn(vaultId).catch(() => null),
    'Vault status check timed out. Please retry.',
  ).catch(() => null);

  const precheckInitial = await withTimeout(
    (getVaultDepositPrecheckFn
      ? getVaultDepositPrecheckFn(vaultId, address, 0)
      : Promise.resolve(null)
    ).catch(() => null),
    'Deposit precheck timed out. Please retry.',
  ).catch(() => null);

  const normalizedPrecheckInitial = normalizePrecheckPayload(precheckInitial);
  if (typeof onPrecheck === 'function') {
    onPrecheck({
      stage: 'initial',
      precheck: normalizedPrecheckInitial,
    });
  }
  const tokenAddress =
    normalizedPrecheckInitial?.tokenAddress ||
    resolveVaultTokenAddress(vaultStatusData, selectedVault);

  if (typeof onDebug === 'function') {
    onDebug({
      stage: 'initial-precheck',
      vaultId,
      address,
      tokenAddress,
      precheckInitial: normalizedPrecheckInitial?.raw ?? null,
      precheckInitialNormalized: normalizedPrecheckInitial,
      vaultStatusData,
    });
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await withTimeout(
    provider.getSigner(),
    'Wallet signer request timed out. Please reopen MetaMask and retry.',
  );
  const hasErc20Token = !!tokenAddress && !isNativeLikeAddress(tokenAddress);
  const tokenContract = hasErc20Token ? new Contract(tokenAddress, ERC20_ABI, signer) : null;

  let decimals = normalizedPrecheckInitial?.decimals ?? 18;
  if (tokenContract) {
    try {
      if (normalizedPrecheckInitial?.decimals === null || normalizedPrecheckInitial?.decimals === undefined) {
        decimals = Number(await withTimeout(tokenContract.decimals(), 'Token decimals read timed out.'));
      }
    } catch {
      throw new Error('Unable to read token decimals.');
    }
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

  onStatus('Building deposit transaction...');
  const buildRes = await withTimeout(
    buildVaultDepositFn(vaultId, amountRaw.toString(), address),
    'Deposit build request timed out. Please retry.',
  );
  const txPayload = extractTxPayload(buildRes);
  if (!txPayload) {
    throw new Error('Deposit transaction missing in backend response');
  }

  const txValue = BigInt(txPayload.value ?? '0');

  const precheckWithAmount = await withTimeout(
    (getVaultDepositPrecheckFn
      ? getVaultDepositPrecheckFn(vaultId, address, amountRaw.toString())
      : Promise.resolve(null)
    ).catch(() => null),
    'Deposit precheck timed out. Please retry.',
  ).catch(() => null);
  const normalizedPrecheckAmount = normalizePrecheckPayload(precheckWithAmount);
  if (typeof onPrecheck === 'function') {
    onPrecheck({
      stage: 'amount',
      precheck: normalizedPrecheckAmount,
    });
  }

  const requiresApprovalByPrecheck =
    normalizedPrecheckAmount?.requiresApproval ??
    normalizedPrecheckAmount?.needsApproval ??
    normalizedPrecheckInitial?.requiresApproval ??
    normalizedPrecheckInitial?.needsApproval ??
    null;

  const isNativeAssetByPrecheck =
    normalizedPrecheckAmount?.isNativeAsset ??
    normalizedPrecheckInitial?.isNativeAsset ??
    null;

  const isNativeDeposit = isNativeAssetByPrecheck === true || txValue > 0n;

  if (typeof onDebug === 'function') {
    onDebug({
      stage: 'amount-precheck',
      vaultId,
      address,
      amountRaw: amountRaw.toString(),
      txTo: txPayload.to,
      txValue: txPayload.value ?? '0',
      tokenAddress,
      precheckAmount: normalizedPrecheckAmount?.raw ?? null,
      precheckAmountNormalized: normalizedPrecheckAmount,
    });
  }

  const canExecutePayloadDirectly = async () => {
    try {
      await withTimeout(ensureChainForTx(txPayload), 'Network switch timed out.');
      await withTimeout(signer.estimateGas({
        to: txPayload.to,
        data: txPayload.data,
        value: txPayload.value ?? '0',
      }), 'Gas estimation timed out.');
      return true;
    } catch {
      return false;
    }
  };

  if (isNativeDeposit) {
    const txCanExecute = await canExecutePayloadDirectly();
    if (!txCanExecute) {
      throw new Error('Deposit simulation failed. Please retry.');
    }

    onStatus('Depositing...');
    return sendBuiltTransactionFn(txPayload);
  }

  if (!tokenContract) {
    throw new Error('Token address not found for this vault.');
  }

  const vaultSpender =
    normalizedPrecheckAmount?.spenderAddress ||
    normalizedPrecheckInitial?.spenderAddress ||
    resolveVaultSpenderAddress(vaultStatusData, selectedVault, txPayload);
  if (!vaultSpender) {
    throw new Error('Vault spender address not found for allowance check.');
  }

  const [ownerBalanceChain, currentAllowanceChain] = await Promise.all([
    tokenContract.balanceOf(address),
    tokenContract.allowance(address, vaultSpender),
  ]);

  const ownerBalance = normalizedPrecheckAmount?.balance ?? ownerBalanceChain;
  const currentAllowance = normalizedPrecheckAmount?.allowance ?? currentAllowanceChain;

  if (typeof onDebug === 'function') {
    onDebug({
      stage: 'erc20-checks',
      vaultId,
      address,
      amountRaw: amountRaw.toString(),
      tokenAddress,
      vaultSpender,
      ownerBalance: ownerBalance.toString(),
      currentAllowance: currentAllowance.toString(),
      ownerBalanceChain: ownerBalanceChain.toString(),
      currentAllowanceChain: currentAllowanceChain.toString(),
    });
  }

  if (normalizedPrecheckAmount?.canDeposit === false && ownerBalance < amountRaw) {
    throw new Error('Solde insuffisant');
  }
  if (normalizedPrecheckAmount?.canDeposit === false && currentAllowance < amountRaw && requiresApprovalByPrecheck === false) {
    throw new Error(normalizedPrecheckAmount.message || 'Allowance insuffisante');
  }

  const txCanExecuteWithoutApprove = await canExecutePayloadDirectly();
  if (txCanExecuteWithoutApprove) {
    onStatus('Depositing...');
    return sendBuiltTransactionFn(txPayload);
  }

  if (ownerBalance < amountRaw) {
    throw new Error('Solde insuffisant');
  }

  const allowanceInsufficientByBackend =
    normalizedPrecheckAmount?.allowanceSufficient === false ||
    requiresApprovalByPrecheck === true;
  const allowanceInsufficientByChain = currentAllowance < amountRaw;

  if (allowanceInsufficientByBackend || allowanceInsufficientByChain) {
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

  const txCanExecuteAfterApprove = await canExecutePayloadDirectly();
  if (!txCanExecuteAfterApprove) {
    throw new Error('Deposit simulation failed after approve.');
  }

  onStatus('Depositing...');
  return sendBuiltTransactionFn(txPayload);
}
