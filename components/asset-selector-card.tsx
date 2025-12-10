"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import {
  Search,
  X,
  Plus,
  Coins,
  Check,
  AlertCircle,
  Sparkles,
  Globe,
  Loader2,
  Wallet,
} from "lucide-react";
import { tokens } from "@web3icons/common/metadata";
import { TokenIcon, NetworkIcon } from "@web3icons/react/dynamic";
import {
  NetworkBinanceSmartChain,
  NetworkXLayer,
  NetworkArbitrumOne,
} from "@web3icons/react";
import { useTokenInfo, useTokenBalance } from "@/lib/contracts";
import { useAccount, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { CHAIN_IDS, getChainConfig, getTokenAddress } from "@/lib/constants";

// Chain type definition
export interface Chain {
  id: string;
  name: string;
  symbol: string;
  chainId: number; // Numeric chain ID for wagmi
}

// Currency type definition
export interface Currency {
  id: string;
  name: string;
  symbol: string;
  icon?: ReactNode;
  iconUrl?: string; // Custom icon URL for imported tokens
  contractAddress?: string;
  isCustom?: boolean;
  chainId?: string;
  decimals?: number;
  isNative?: boolean; // true for native chain tokens like ETH, BNB
}

// Chain ID to Trust Wallet assets chain name mapping
const CHAIN_TO_TRUST_WALLET: Record<string, string> = {
  "localnet": "ethereum", // Use ethereum icons for localnet
  "x-layer": "xlayer", // X Layer might not be supported, fallback
  "binance-smart-chain": "smartchain",
  "arbitrum-one": "arbitrum",
};

// Get token icon URL from Trust Wallet Assets
export function getTokenIconUrl(contractAddress: string, chainId: string): string {
  const trustWalletChain = CHAIN_TO_TRUST_WALLET[chainId] || "ethereum";
  const checksumAddress = contractAddress; // Ideally should be checksummed
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trustWalletChain}/assets/${checksumAddress}/logo.png`;
}

// Define supported chains with their numeric IDs
export const defaultChains: Chain[] = [
  { id: "localnet", name: "Localnet", symbol: "localnet", chainId: CHAIN_IDS.HARDHAT },
  { id: "x-layer", name: "X Layer", symbol: "x-layer", chainId: CHAIN_IDS.XLAYER },
  { id: "binance-smart-chain", name: "BNB Smart Chain", symbol: "binance-smart-chain", chainId: CHAIN_IDS.BSC },
  { id: "arbitrum-one", name: "Arbitrum", symbol: "arbitrum-one", chainId: CHAIN_IDS.ARBITRUM },
];

// Get chain ID string from numeric ID
export function getChainStringId(numericChainId: number): string {
  const chain = defaultChains.find(c => c.chainId === numericChainId);
  return chain?.id || "unknown";
}

// Per-chain currency configurations
export function getCurrenciesForChain(chainId: number): Currency[] {
  switch (chainId) {
    case CHAIN_IDS.HARDHAT:
      return [
        { 
          id: "localnet-eth", 
          name: "Localnet ETH", 
          symbol: "ETH", 
          isNative: true, 
          decimals: 18,
          chainId: "localnet",
        },
        { 
          id: "localnet-usdt", 
          name: "Mock USDT", 
          symbol: "USDT", 
          contractAddress: getTokenAddress(CHAIN_IDS.HARDHAT, 'USDT'),
          decimals: 6,
          chainId: "localnet",
        },
        { 
          id: "localnet-usdc", 
          name: "Mock USDC", 
          symbol: "USDC", 
          contractAddress: getTokenAddress(CHAIN_IDS.HARDHAT, 'USDC'),
          decimals: 6,
          chainId: "localnet",
        },
        { 
          id: "localnet-xwaifu", 
          name: "xWaifu Token", 
          symbol: "xWaifu", 
          contractAddress: getTokenAddress(CHAIN_IDS.HARDHAT, 'XWAIFU'),
          decimals: 18,
          chainId: "localnet",
        },
      ];
    
    case CHAIN_IDS.XLAYER:
      return [
        { 
          id: "xlayer-okb", 
          name: "OKB", 
          symbol: "OKB", 
          isNative: true, 
          decimals: 18,
          chainId: "x-layer",
        },
        { 
          id: "xlayer-usdt", 
          name: "USDT", 
          symbol: "USDT", 
          contractAddress: getTokenAddress(CHAIN_IDS.XLAYER, 'USDT'),
          decimals: 6,
          chainId: "x-layer",
        },
        { 
          id: "xlayer-usdc", 
          name: "USDC", 
          symbol: "USDC", 
          contractAddress: getTokenAddress(CHAIN_IDS.XLAYER, 'USDC'),
          decimals: 6,
          chainId: "x-layer",
        },
        { 
          id: "xlayer-xwaifu", 
          name: "xWaifu", 
          symbol: "xWaifu", 
          contractAddress: getTokenAddress(CHAIN_IDS.XLAYER, 'XWAIFU'),
          decimals: 18,
          chainId: "x-layer",
        },
      ];
    
    case CHAIN_IDS.BSC:
      return [
        { 
          id: "bsc-bnb", 
          name: "BNB", 
          symbol: "BNB", 
          isNative: true, 
          decimals: 18,
          chainId: "binance-smart-chain",
        },
        { 
          id: "bsc-usdt", 
          name: "USDT", 
          symbol: "USDT", 
          contractAddress: getTokenAddress(CHAIN_IDS.BSC, 'USDT'),
          decimals: 18, // BSC USDT is 18 decimals
          chainId: "binance-smart-chain",
        },
        { 
          id: "bsc-usdc", 
          name: "USDC", 
          symbol: "USDC", 
          contractAddress: getTokenAddress(CHAIN_IDS.BSC, 'USDC'),
          decimals: 18,
          chainId: "binance-smart-chain",
        },
      ];
    
    case CHAIN_IDS.ARBITRUM:
      return [
        { 
          id: "arb-eth", 
          name: "Ethereum", 
          symbol: "ETH", 
          isNative: true, 
          decimals: 18,
          chainId: "arbitrum-one",
        },
        { 
          id: "arb-usdt", 
          name: "USDT", 
          symbol: "USDT", 
          contractAddress: getTokenAddress(CHAIN_IDS.ARBITRUM, 'USDT'),
          decimals: 6,
          chainId: "arbitrum-one",
        },
        { 
          id: "arb-usdc", 
          name: "USDC", 
          symbol: "USDC", 
          contractAddress: getTokenAddress(CHAIN_IDS.ARBITRUM, 'USDC'),
          decimals: 6,
          chainId: "arbitrum-one",
        },
      ];
    
    default:
      // Fallback to generic tokens
      return [
        { id: "ETH", name: "Ethereum", symbol: "ETH", isNative: true, decimals: 18 },
        { id: "USDT", name: "Tether", symbol: "USDT", decimals: 6 },
        { id: "USDC", name: "USD Coin", symbol: "USDC", decimals: 6 },
      ];
  }
}

// Default currencies - fallback when chain is not connected
export const defaultCurrencies: Currency[] = [
  { id: "ETH", name: "Ethereum", symbol: "ETH", isNative: true, decimals: 18 },
  { id: "BNB", name: "BNB", symbol: "BNB", isNative: true, decimals: 18 },
  { id: "OKB", name: "OKB", symbol: "OKB", isNative: true, decimals: 18 },
  { id: "USDT", name: "Tether", symbol: "USDT", decimals: 6 },
  { id: "USDC", name: "USD Coin", symbol: "USDC", decimals: 6 },
  { id: "WBTC", name: "Wrapped Bitcoin", symbol: "WBTC", decimals: 8 },
];

// Localnet specific tokens with actual addresses (legacy, use getCurrenciesForChain instead)
export const localnetCurrencies: Currency[] = getCurrenciesForChain(CHAIN_IDS.HARDHAT);

// LocalStorage keys
const CUSTOM_CURRENCIES_KEY = "rainbow-bridge-custom-currencies";

function searchTokens(query: string) {
  const q = query.toLowerCase();
  return tokens.filter(
    (t) =>
      t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q),
  );
}

function hasTokenIcon(symbol: string): boolean {
  // Check for exact symbol match (case-insensitive)
  const lowerSymbol = symbol.toLowerCase();
  return tokens.some((t) => t.symbol.toLowerCase() === lowerSymbol);
}

// Get the best available variant for a token (prefer branded, fallback to mono)
function getTokenVariant(symbol: string): "branded" | "mono" {
  const lowerSymbol = symbol.toLowerCase();
  const token = tokens.find((t) => t.symbol.toLowerCase() === lowerSymbol);
  if (token && token.variants) {
    // Prefer branded if available, otherwise use mono
    if (token.variants.includes("branded")) return "branded";
    if (token.variants.includes("mono")) return "mono";
  }
  return "branded"; // default
}

// Check if network icon exists
function hasNetworkIcon(symbol: string): boolean {
  const knownNetworks = ["ethereum", "x-layer", "arbitrum-one", "binance-smart-chain", "localnet"];
  return knownNetworks.includes(symbol.toLowerCase());
}

function GenericTokenIcon({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-full bg-linear-to-br from-slate-400 to-slate-600 flex items-center justify-center",
        className,
      )}
    >
      <span className="text-white font-bold text-xs">
        {symbol.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

function GenericChainIcon({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-linear-to-br from-indigo-400 to-purple-600 flex items-center justify-center",
        className,
      )}
    >
      <Globe className="w-1/2 h-1/2 text-white" />
    </div>
  );
}

// Component to display token balance
function TokenBalanceDisplay({
  tokenAddress,
  userAddress,
  decimals,
  symbol,
}: {
  tokenAddress: `0x${string}`;
  userAddress: `0x${string}`;
  decimals: number;
  symbol: string;
}) {
  const { data: balance, isLoading } = useTokenBalance(tokenAddress, userAddress);

  const formatBalance = (bal: bigint | undefined) => {
    if (bal === undefined) return "0";
    const formatted = formatUnits(bal, decimals);
    const num = parseFloat(formatted);
    if (num === 0) return "0";
    if (num < 0.001) return "<0.001";
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(num < 1 ? 4 : 2);
  };

  if (isLoading) {
    return (
      <div className="text-[9px] text-slate-400 mt-0.5">
        <Loader2 className="w-2.5 h-2.5 animate-spin inline" />
      </div>
    );
  }

  const bal = balance as bigint | undefined;
  const hasBalance = bal !== undefined && bal > 0n;

  return (
    <div className={cn(
      "text-[9px] mt-0.5 font-mono",
      hasBalance ? "text-emerald-500" : "text-slate-400"
    )}>
      {formatBalance(bal)}
    </div>
  );
}

// CurrencyIcon with fallback chain for custom icon URLs
export function CurrencyIcon({
  symbol,
  className = "w-8 h-8",
  iconUrl,
  contractAddress,
  chainId,
}: {
  symbol: string;
  className?: string;
  iconUrl?: string;
  contractAddress?: string;
  chainId?: string;
}) {
  const [imgError, setImgError] = useState(false);
  
  // Try to get icon URL from Trust Wallet if we have contract address
  const fallbackIconUrl = contractAddress && chainId 
    ? getTokenIconUrl(contractAddress, chainId) 
    : undefined;
  
  const imageUrl = iconUrl || fallbackIconUrl;
  
  // If we have a valid image URL and it hasn't errored, use it
  if (imageUrl && !imgError) {
    return (
      <img 
        src={imageUrl} 
        alt={symbol}
        className={cn("rounded-full", className)}
        onError={() => setImgError(true)}
      />
    );
  }
  
  // Try web3icons library with the best available variant
  if (hasTokenIcon(symbol)) {
    const variant = getTokenVariant(symbol);
    return (
      <TokenIcon
        symbol={symbol.toLowerCase()}
        variant={variant}
        className={className}
      />
    );
  }
  
  // Fallback to generic icon
  return <GenericTokenIcon symbol={symbol} className={className} />;
}

export function ChainIcon({
  symbol,
  className = "w-8 h-8",
}: {
  symbol: string;
  className?: string;
}) {
  const lowerSymbol = symbol.toLowerCase();
  
  // Use specific imported icons for known chains
  switch (lowerSymbol) {
    case "x-layer":
      return <NetworkXLayer className={className} variant="branded" />;
    case "binance-smart-chain":
      return <NetworkBinanceSmartChain className={className} variant="branded" />;
    case "arbitrum-one":
      return <NetworkArbitrumOne className={className} variant="branded" />;
    case "ethereum":
    case "localnet":
      // Use dynamic NetworkIcon for ethereum
      return <NetworkIcon name="ethereum" variant="branded" className={className} />;
    default:
      // Try dynamic NetworkIcon, fallback to generic
      if (hasNetworkIcon(symbol)) {
        return <NetworkIcon name={symbol} variant="branded" className={className} />;
      }
      return <GenericChainIcon symbol={symbol} className={className} />;
  }
}

interface AddCurrencyCardProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (currency: Currency) => void;
  existingCurrencies: Currency[];
  activeChain: string;
}

function AddCurrencyCard({
  isOpen,
  onClose,
  onAdd,
  existingCurrencies,
  activeChain,
}: AddCurrencyCardProps) {
  const { t } = useI18n();
  const { address } = useAccount();
  const [customAddress, setCustomAddress] = useState("");
  const [addressError, setAddressError] = useState("");
  const [selectedChainForImport, setSelectedChainForImport] = useState(activeChain);

  // Update selected chain when activeChain changes
  useEffect(() => {
    setSelectedChainForImport(activeChain);
  }, [activeChain]);

  // Validate address format
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(customAddress);
  const tokenAddress = isValidAddress ? customAddress as `0x${string}` : undefined;

  // Auto-fetch token info when address is valid
  const { name, symbol, decimals, isLoading: tokenLoading, isValid: tokenValid, error: tokenError } = useTokenInfo(tokenAddress);
  
  // Fetch user balance
  const { data: balance } = useTokenBalance(tokenAddress, address);

  const formatBalance = (bal: bigint | undefined, dec: number | undefined) => {
    if (bal === undefined || dec === undefined) return "0";
    const formatted = formatUnits(bal, dec);
    const num = parseFloat(formatted);
    if (num === 0) return "0";
    if (num < 0.0001) return "<0.0001";
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const handleAdd = () => {
    if (!tokenValid || !symbol) {
      setAddressError("Invalid token contract");
      return;
    }

    const exists = existingCurrencies.some(
      (c) => c.contractAddress?.toLowerCase() === customAddress.toLowerCase() && c.chainId === selectedChainForImport,
    );
    if (exists) {
      setAddressError(t("form.assetSelector.currencyExists"));
      return;
    }

    // Generate icon URL from Trust Wallet assets
    const iconUrl = getTokenIconUrl(customAddress, selectedChainForImport);

    const newCurrency: Currency = {
      id: `custom-${symbol}-${Date.now()}`,
      name: name || symbol,
      symbol: symbol,
      contractAddress: customAddress,
      isCustom: true,
      chainId: selectedChainForImport,
      decimals: decimals,
      iconUrl: iconUrl,
    };

    onAdd(newCurrency);
    handleClose();
  };

  const handleClose = useCallback(() => {
    setCustomAddress("");
    setAddressError("");
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-60 w-[90vw] max-w-md"
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                <div className="absolute inset-0 bg-linear-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-linear-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        {t("form.assetSelector.addCustomTitle")}
                      </h3>
                      <p className="text-sm text-slate-500">
                        输入代币合约地址自动获取信息
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClose}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </motion.button>
                </div>
              </div>

              {/* Form */}
              <div className="p-6 space-y-5">
                {/* Chain Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    选择链
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {defaultChains.map((chain) => (
                      <button
                        key={chain.id}
                        onClick={() => setSelectedChainForImport(chain.id)}
                        className={cn(
                          "p-2 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-1",
                          selectedChainForImport === chain.id
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        )}
                      >
                        <ChainIcon symbol={chain.id} className="w-6 h-6" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate w-full text-center">
                          {chain.name.length > 8 ? chain.name.slice(0, 8) + '...' : chain.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t("form.assetSelector.contractAddress")}
                  </label>
                  <Input
                    type="text"
                    placeholder="0x..."
                    value={customAddress}
                    onChange={(e) => {
                      setCustomAddress(e.target.value.trim());
                      setAddressError("");
                    }}
                    className={cn(
                      "h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm",
                      addressError && "border-red-500",
                    )}
                  />
                  {addressError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 text-red-500 text-xs"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {addressError}
                    </motion.div>
                  )}
                </div>

                {/* Token Info Preview */}
                {isValidAddress && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    {tokenLoading ? (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        <span className="text-sm text-slate-500">获取代币信息中...</span>
                      </div>
                    ) : tokenValid ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{symbol?.slice(0, 2)}</span>
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{symbol}</div>
                            <div className="text-sm text-slate-500">{name}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-sm text-slate-500 flex items-center gap-1.5">
                            <Wallet className="w-4 h-4" />
                            你的余额
                          </span>
                          <span className="font-mono font-medium text-slate-900 dark:text-white">
                            {formatBalance(balance as bigint | undefined, decimals)} {symbol}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>精度: {decimals} 位</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-2 text-red-500">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">无效的代币合约或无法获取信息</span>
                      </div>
                    )}
                  </motion.div>
                )}

                <Button
                  onClick={handleAdd}
                  disabled={!tokenValid || tokenLoading}
                  className="w-full h-12 bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                >
                  {tokenLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      获取中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      {t("form.assetSelector.addCurrency")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface AssetSelectorCardProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCurrency: string;
  onSelectCurrency: (currency: Currency) => void;
  selectedChain: string;
  onSelectChain?: (chainId: string) => void;
}

export function AssetSelectorCard({
  isOpen,
  onClose,
  selectedCurrency,
  onSelectCurrency,
  selectedChain,
  onSelectChain,
}: AssetSelectorCardProps) {
  const { t } = useI18n();
  const { address } = useAccount();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCurrencyCard, setShowAddCurrencyCard] = useState(false);
  const [customCurrencies, setCustomCurrencies] = useState<Currency[]>([]);
  const [activeChain, setActiveChain] = useState(selectedChain);

  useEffect(() => {
    setActiveChain(selectedChain);
  }, [selectedChain]);

  // Load custom currencies from localStorage
  useEffect(() => {
    const storedCurrencies = localStorage.getItem(CUSTOM_CURRENCIES_KEY);
    if (storedCurrencies) {
      try {
        setCustomCurrencies(JSON.parse(storedCurrencies));
      } catch (e) {
        console.error("Failed to parse custom currencies", e);
      }
    }
  }, []);

  const saveCustomCurrencies = (currencies: Currency[]) => {
    localStorage.setItem(CUSTOM_CURRENCIES_KEY, JSON.stringify(currencies));
  };

  // Get currencies based on active chain
  const chainCurrencies = useMemo(() => {
    // Get the numeric chain ID for the active chain
    const chainConfig = defaultChains.find(c => c.id === activeChain);
    const numericChainId = chainConfig?.chainId || CHAIN_IDS.HARDHAT;
    
    // Get default currencies for this specific chain
    const defaultForChain = getCurrenciesForChain(numericChainId);
    
    // Get custom currencies that were added for this chain
    const chainCustom = customCurrencies.filter(c => c.chainId === activeChain);
    
    return [...defaultForChain, ...chainCustom];
  }, [activeChain, customCurrencies]);

  // Filtered currencies based on search
  const filteredCurrencies = useMemo(() => {
    if (!searchQuery) return chainCurrencies;
    const q = searchQuery.toLowerCase();
    return chainCurrencies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q),
    );
  }, [chainCurrencies, searchQuery]);

  const handleAddCurrency = (currency: Currency) => {
    // Add chain info to the currency
    const currencyWithChain = { ...currency, chainId: activeChain };
    const updated = [...customCurrencies, currencyWithChain];
    setCustomCurrencies(updated);
    saveCustomCurrencies(updated);
    onSelectCurrency(currencyWithChain);
  };

  const handleSelect = (currency: Currency) => {
    onSelectCurrency(currency);
    if (onSelectChain) {
      onSelectChain(activeChain);
    }
    onClose();
  };

  const handleChainSelect = (chainId: string) => {
    setActiveChain(chainId);
  };

  const handleOpenCard = useCallback(() => {
    setSearchQuery("");
    setShowAddCurrencyCard(false);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      handleOpenCard();
      window.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, handleOpenCard]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
              onClick={onClose}
            />

            {/* Main Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-4xl"
            >
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/20 overflow-hidden">
                {/* Header */}
                <div className="relative">
                  <div className="absolute inset-0 bg-linear-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 dark:from-amber-500/20 dark:via-orange-500/20 dark:to-rose-500/20" />
                  <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-linear-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
                        <Coins className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          {t("form.assetSelector.title")}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {t("form.assetSelector.subtitle")}
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onClose}
                      className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </motion.button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row min-h-[400px]">
                  {/* Left Side - Chains */}
                  <div className="w-full md:w-1/3 p-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                      {t("form.assetSelector.selectChain")}
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      {defaultChains.map((chain, index) => (
                        // console.log(chain, index),
                        <motion.button
                          key={chain.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleChainSelect(chain.id)}
                          className={cn(
                            "relative p-3 rounded-xl text-center transition-all duration-200 border-2 group aspect-square flex flex-col items-center justify-center",
                            activeChain === chain.id
                              ? "bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-amber-500 shadow-lg shadow-amber-500/20"
                              : "bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-amber-400 dark:hover:border-amber-500",
                          )}
                        >
                          {activeChain === chain.id && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-1.5 right-1.5"
                            >
                              <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            </motion.div>
                          )}

                          <div
                            className={cn(
                              "p-2 rounded-xl mb-1.5 transition-all",
                              activeChain === chain.id
                                ? "bg-white dark:bg-slate-900 shadow-md"
                                : "bg-slate-100 dark:bg-slate-700/50 group-hover:bg-white dark:group-hover:bg-slate-700",
                            )}
                          >
                            <ChainIcon symbol={chain.id} className="w-6 h-6" />
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-full px-1">
                            {chain.name}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Right Side - Currencies */}
                  <div className="w-full md:w-2/3 flex flex-col">
                    {/* Search */}
                    <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder={t(
                            "form.assetSelector.searchPlaceholder",
                          )}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-11 h-10 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl focus:ring-2 focus:ring-amber-500/50"
                        />
                      </div>
                    </div>

                    {/* Currency List */}
                    <div className="flex-1 p-4 overflow-y-auto max-h-[350px]">
                      {filteredCurrencies.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                          <Coins className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>{t("form.assetSelector.noResults")}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {filteredCurrencies.map((currency, index) => (
                            <motion.button
                              key={currency.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleSelect(currency)}
                              className={cn(
                                "relative p-3 rounded-xl transition-all duration-200 border-2 group flex items-center gap-3",
                                selectedCurrency === currency.symbol
                                  ? "bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-amber-500 shadow-lg shadow-amber-500/20"
                                  : "bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-amber-400 dark:hover:border-amber-500",
                              )}
                            >
                              {/* Left: Icon */}
                              <div
                                className={cn(
                                  "p-2 rounded-xl transition-all shrink-0",
                                  selectedCurrency === currency.symbol
                                    ? "bg-white dark:bg-slate-900 shadow-md"
                                    : "bg-slate-100 dark:bg-slate-700/50 group-hover:bg-white dark:group-hover:bg-slate-700",
                                )}
                              >
                                <CurrencyIcon
                                  symbol={currency.symbol}
                                  className="w-6 h-6"
                                  iconUrl={currency.iconUrl}
                                  contractAddress={currency.contractAddress}
                                  chainId={currency.chainId}
                                />
                              </div>
                              
                              {/* Middle: Info */}
                              <div className="flex-1 text-left min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                                    {currency.symbol}
                                  </span>
                                  {currency.isCustom && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-linear-to-r from-blue-500 to-cyan-500 text-white rounded">
                                      {t("form.assetSelector.customBadge")}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {currency.name}
                                </div>
                                {currency.contractAddress && (
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5">
                                    {currency.contractAddress.slice(0, 6)}...{currency.contractAddress.slice(-4)}
                                  </div>
                                )}
                              </div>
                              
                              {/* Right: Balance & Check */}
                              <div className="flex items-center gap-2 shrink-0">
                                {address && currency.contractAddress && (
                                  <TokenBalanceDisplay 
                                    tokenAddress={currency.contractAddress as `0x${string}`}
                                    userAddress={address}
                                    decimals={currency.decimals || 18}
                                    symbol={currency.symbol}
                                  />
                                )}
                                {selectedCurrency === currency.symbol && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                  >
                                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add Currency Button */}
                    <div className="px-4 pb-4">
                      <Button
                        onClick={() => setShowAddCurrencyCard(true)}
                        variant="outline"
                        className="w-full h-10 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-amber-500 rounded-xl transition-all group"
                      >
                        <Plus className="w-4 h-4 mr-2 group-hover:text-amber-500" />
                        <span className="group-hover:text-amber-500">
                          {t("form.assetSelector.addOther")}
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AddCurrencyCard
        isOpen={showAddCurrencyCard}
        onClose={() => setShowAddCurrencyCard(false)}
        onAdd={handleAddCurrency}
        existingCurrencies={chainCurrencies}
        activeChain={activeChain}
      />
    </>
  );
}
