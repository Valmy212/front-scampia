import { useState, useCallback, useEffect } from "react";
import { BrowserProvider } from "ethers";

const WALLET_MANUAL_DISCONNECT_KEY = "scampia_wallet_manually_disconnected";

const NETWORKS = {
  sepolia: {
    chainId: "0xaa36a7",
    name: "Sepolia",
    rpcUrls: ["https://rpc.sepolia.org"],
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
    explorer: "https://sepolia.etherscan.io",
  },
  mainnet: {
    chainId: "0x1",
    name: "Ethereum",
    rpcUrls: ["https://eth.drpc.org"],
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
    explorer: "https://etherscan.io",
  },
};

const ACTIVE_NETWORK = NETWORKS.sepolia;

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoChecked, setAutoChecked] = useState(false);

  const isManuallyDisconnected = useCallback(() => {
    try {
      return window.localStorage.getItem(WALLET_MANUAL_DISCONNECT_KEY) === "1";
    } catch {
      return false;
    }
  }, []);

  const setManualDisconnectFlag = useCallback((value) => {
    try {
      if (value) {
        window.localStorage.setItem(WALLET_MANUAL_DISCONNECT_KEY, "1");
      } else {
        window.localStorage.removeItem(WALLET_MANUAL_DISCONNECT_KEY);
      }
    } catch {
      // Ignore storage failures (private mode, policy restrictions, etc.).
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ACTIVE_NETWORK.chainId }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: ACTIVE_NETWORK.chainId,
            chainName: ACTIVE_NETWORK.name,
            rpcUrls: ACTIVE_NETWORK.rpcUrls,
            nativeCurrency: ACTIVE_NETWORK.currency,
            blockExplorerUrls: [ACTIVE_NETWORK.explorer],
          }],
        });
      } else {
        throw err;
      }
    }
  }, []);

  // Au chargement, vérifier si MetaMask est déjà connecté (sans prompt)
  useEffect(() => {
    if (!window.ethereum) {
      setAutoChecked(true);
      return;
    }

    if (isManuallyDisconnected()) {
      setAddress(null);
      setAutoChecked(true);
      return;
    }

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
        }
      })
      .catch(() => {})
      .finally(() => setAutoChecked(true));
  }, [isManuallyDisconnected]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (!Array.isArray(accounts) || accounts.length === 0) {
        setAddress(null);
        return;
      }

      if (isManuallyDisconnected()) {
        setAddress(null);
        return;
      }

      setAddress(accounts[0]);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [isManuallyDisconnected]);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.ethereum) throw new Error("MetaMask non détecté");
      setManualDisconnectFlag(false);
      await switchNetwork();
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAddress(accounts[0]);
      return accounts[0];
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setManualDisconnectFlag, switchNetwork]);

  const disconnect = useCallback(async () => {
    setManualDisconnectFlag(true);

    // Best effort: some wallets support explicit permission revocation.
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Not all providers support this method.
      }
    }

    setAddress(null);
  }, [setManualDisconnectFlag]);

  const switchToChainId = useCallback(async (chainId) => {
    if (!chainId || !window.ethereum) return;
    const hexChainId = typeof chainId === "number" ? `0x${chainId.toString(16)}` : chainId;
    if (!hexChainId) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } catch (err) {
      if (err.code !== 4902) {
        throw err;
      }
    }
  }, []);

  const sendBuiltTransaction = useCallback(async (txLike) => {
    if (!window.ethereum) throw new Error("MetaMask non détecté");
    if (!txLike || typeof txLike !== "object") {
      throw new Error("Invalid transaction payload");
    }

    await switchToChainId(txLike.chainId ?? txLike.chain_id);

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return signer.sendTransaction({
      to: txLike.to,
      data: txLike.data,
      value: txLike.value ?? "0",
    });
  }, [switchToChainId]);

  return {
    address,
    loading,
    error,
    autoChecked,
    connect,
    disconnect,
    sendBuiltTransaction,
    network: ACTIVE_NETWORK.name,
  };
}