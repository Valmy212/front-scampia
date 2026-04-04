import { useState, useCallback, useEffect } from "react";
import { BrowserProvider, parseEther } from "ethers";

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
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
        }
      })
      .catch(() => {})
      .finally(() => setAutoChecked(true));
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.ethereum) throw new Error("MetaMask non détecté");
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
  }, [switchNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const depositEth = useCallback(async (safeAddress, amountInEth) => {
    if (!window.ethereum) throw new Error("MetaMask non détecté");
    await switchNetwork();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return signer.sendTransaction({
      to: safeAddress,
      value: parseEther(amountInEth),
    });
  }, [switchNetwork]);

  return { address, loading, error, autoChecked, connect, disconnect, depositEth, network: ACTIVE_NETWORK.name };
}