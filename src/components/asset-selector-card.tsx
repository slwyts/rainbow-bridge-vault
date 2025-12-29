"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
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
// Static imports only - dynamic imports cause 2000+ chunk files!
import {
  // Network icons
  NetworkBinanceSmartChain,
  NetworkXLayer,
  NetworkArbitrumOne,
  NetworkEthereum,
  NetworkPolygon,
  NetworkAvalanche,
  NetworkOptimism,
  NetworkBase,
  NetworkFantom,
  NetworkCronos,
  NetworkGnosis,
  NetworkZksync,
  NetworkLinea,
  NetworkScroll,
  NetworkBlast,
  NetworkMantle,
  NetworkCelo,
  NetworkMoonbeam,
  NetworkMoonriver,
  NetworkHarmony,
  NetworkAurora,
  NetworkBoba,
  NetworkKava,
  // Native token icons
  TokenETH,
  TokenBNB,
  TokenMATIC,
  TokenAVAX,
  TokenSOL,
  TokenFTM,
  TokenOP,
  TokenOKB,
  TokenCRO,
  TokenONE,
  TokenCELO,
  TokenGLMR,
  TokenMOVR,
  TokenKAVA,
  // Common ERC20 tokens
  TokenUSDT,
  TokenUSDC,
  TokenDAI,
  TokenWBTC,
  TokenLINK,
  TokenUNI,
  TokenAAVE,
  TokenCRV,
  TokenMKR,
  TokenSNX,
  TokenCOMP,
  TokenSUSHI,
  Token1INCH,
  TokenLDO,
  TokenRPL,
  TokenAPE,
  TokenSHIB,
  TokenPEPE,
  TokenARB,
  TokenGMX,
  TokenDYDX,
  TokenENS,
  TokenGRT,
  TokenFRAX,
  TokenLUSD,
  TokenRETH,
  TokenCBETH,
} from "@web3icons/react";
import { useTokenInfo, useTokenBalance } from "@/lib/contracts";
import { useAccount } from "wagmi";
import { formatUnits, getAddress } from "viem";
import {
  CHAIN_IDS,
  CHAIN_CONFIGS,
  getAllChainIds,
  CHAIN_TO_TRUST_WALLET,
  getOKLinkTokenIconUrl,
  getDyorswapTokenIconUrl,
  getFixedTokenIconUrl,
  getIconavesTokenIconUrl,
  getChainNumericId,
  getCurrenciesForChain,
  type Currency,
  type SupportedChainId,
} from "@/lib/chains";

// Chain type definition
interface Chain {
  id: string;
  name: string;
  symbol: string;
  chainId: number; // Numeric chain ID for wagmi
}

// Re-export Currency type for external use
export type { Currency };

// Get token icon URL from Trust Wallet Assets
function getTokenIconUrl(
  contractAddress: string,
  chainId: string
): string | undefined {
  const trustWalletChain = CHAIN_TO_TRUST_WALLET[chainId] || "ethereum";
  // Trust Wallet requires checksum address (mixed case)
  try {
    const checksumAddress = getAddress(contractAddress);
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trustWalletChain}/assets/${checksumAddress}/logo.png`;
  } catch {
    return undefined;
  }
}

// 从统一配置生成 defaultChains（只包含已启用的链）
const defaultChains: Chain[] = getAllChainIds().map((chainId) => {
  const config = CHAIN_CONFIGS[chainId as SupportedChainId];
  return {
    id: config.stringId,
    name: config.name,
    symbol: config.stringId,
    chainId: config.chainId,
  };
});

// Re-export getCurrenciesForChain for external use
export { getCurrenciesForChain };

// LocalStorage keys
const CUSTOM_CURRENCIES_KEY = "rainbow-bridge-custom-currencies";

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
        "flex items-center justify-center rounded-full bg-linear-to-br from-slate-400 to-slate-600",
        className
      )}
    >
      <span className="text-xs font-bold text-white">
        {symbol.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

function GenericChainIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-linear-to-br from-indigo-400 to-purple-600",
        className
      )}
    >
      <Globe className="h-1/2 w-1/2 text-white" />
    </div>
  );
}

// Component to display token balance
function TokenBalanceDisplay({
  tokenAddress,
  userAddress,
  decimals,
  chainId,
}: {
  tokenAddress: `0x${string}`;
  userAddress: `0x${string}`;
  decimals: number;
  chainId?: number;
}) {
  const { data: balance, isLoading } = useTokenBalance(
    tokenAddress,
    userAddress,
    chainId
  );

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
      <div className="mt-0.5 text-[9px] text-slate-400">
        <Loader2 className="inline h-2.5 w-2.5 animate-spin" />
      </div>
    );
  }

  const bal = balance as bigint | undefined;
  const hasBalance = bal !== undefined && bal > 0n;

  return (
    <div
      className={cn(
        "mt-0.5 font-mono text-[9px]",
        hasBalance ? "text-emerald-500" : "text-slate-400"
      )}
    >
      {formatBalance(bal)}
    </div>
  );
}

// 代币图标映射（原生代币 + 常见 ERC20）
const TOKEN_ICONS: Record<string, typeof TokenETH> = {
  // Native tokens
  ETH: TokenETH,
  WETH: TokenETH, // 用 ETH 图标代替
  BNB: TokenBNB,
  MATIC: TokenMATIC,
  POL: TokenMATIC,
  AVAX: TokenAVAX,
  SOL: TokenSOL,
  FTM: TokenFTM,
  OP: TokenOP,
  OKB: TokenOKB,
  CRO: TokenCRO,
  ONE: TokenONE,
  CELO: TokenCELO,
  GLMR: TokenGLMR,
  MOVR: TokenMOVR,
  KAVA: TokenKAVA,
  // Stablecoins
  USDT: TokenUSDT,
  USDC: TokenUSDC,
  DAI: TokenDAI,
  FRAX: TokenFRAX,
  LUSD: TokenLUSD,
  // Wrapped & LST
  WBTC: TokenWBTC,
  RETH: TokenRETH,
  CBETH: TokenCBETH,
  // DeFi tokens
  LINK: TokenLINK,
  UNI: TokenUNI,
  AAVE: TokenAAVE,
  CRV: TokenCRV,
  MKR: TokenMKR,
  SNX: TokenSNX,
  COMP: TokenCOMP,
  SUSHI: TokenSUSHI,
  "1INCH": Token1INCH,
  LDO: TokenLDO,
  RPL: TokenRPL,
  GMX: TokenGMX,
  DYDX: TokenDYDX,
  // Other popular tokens
  APE: TokenAPE,
  SHIB: TokenSHIB,
  PEPE: TokenPEPE,
  ARB: TokenARB,
  ENS: TokenENS,
  GRT: TokenGRT,
};

// 保留旧的映射名以兼容
const NATIVE_TOKEN_ICONS = TOKEN_ICONS;

// CurrencyIcon with fallback: Fixed -> Native -> Dyorswap -> iconaves -> Trust Wallet -> OKLink -> Generic
export function CurrencyIcon({
  symbol,
  className = "w-8 h-8",
  iconUrl,
  contractAddress,
  chainId,
  isNative,
}: {
  symbol: string;
  className?: string;
  iconUrl?: string;
  contractAddress?: string;
  chainId?: string;
  isNative?: boolean;
}) {
  // 检查是否有固定图标（最高优先级）
  const fixedIconUrl = contractAddress && chainId
    ? getFixedTokenIconUrl(contractAddress, chainId)
    : undefined;

  // 原生代币优先使用库图标（但不要在 hooks 之前 return）
  const NativeIcon = NATIVE_TOKEN_ICONS[symbol.toUpperCase()];
  const shouldUseNativeIcon = (isNative || !contractAddress) && !!NativeIcon && !fixedIconUrl;

  // OKLink tokenType 尝试顺序
  const oklinkTokenTypes = [107, 109, 105, 110];

  // 预先生成所有可能的 URL 列表
  const allUrls = useMemo(() => {
    const urls: string[] = [];

    // 1. 固定图标
    if (fixedIconUrl) urls.push(fixedIconUrl);
    // 2. 自定义 iconUrl
    if (iconUrl) urls.push(iconUrl);
    // 3. Dyorswap (X Layer only)
    if (contractAddress && chainId === "x-layer") {
      const url = getDyorswapTokenIconUrl(contractAddress, chainId);
      if (url) urls.push(url);
    }
    // 4. iconaves.com
    if (contractAddress && chainId) {
      const url = getIconavesTokenIconUrl(contractAddress, chainId);
      if (url) urls.push(url);
    }
    // 5. Trust Wallet
    if (contractAddress && chainId) {
      const url = getTokenIconUrl(contractAddress, chainId);
      if (url) urls.push(url);
    }
    // 6. OKLink (multiple tokenTypes)
    if (contractAddress && chainId) {
      for (const tokenType of oklinkTokenTypes) {
        const url = getOKLinkTokenIconUrl(contractAddress, chainId, tokenType);
        if (url) urls.push(url);
      }
    }

    return urls;
  }, [fixedIconUrl, iconUrl, contractAddress, chainId]);

  // 当前尝试的 URL 索引
  const [urlIndex, setUrlIndex] = useState(0);
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  // 当 token 变化时重置
  const tokenKey = `${chainId ?? ""}:${contractAddress ?? ""}:${symbol}`;
  useEffect(() => {
    setUrlIndex(0);
    setImgStatus('loading');
  }, [tokenKey]);

  const currentUrl = allUrls[urlIndex];

  // 图片加载失败时，尝试下一个 URL
  const handleError = useCallback(() => {
    if (urlIndex < allUrls.length - 1) {
      setUrlIndex(prev => prev + 1);
      setImgStatus('loading');
    } else {
      setImgStatus('error');
    }
  }, [urlIndex, allUrls.length]);

  // 图片加载成功
  const handleLoad = useCallback(() => {
    setImgStatus('loaded');
  }, []);

  // 如果是原生代币并且存在对应图标，优先显示
  if (shouldUseNativeIcon) {
    return <NativeIcon className={className} />;
  }

  // 如果有 URL 可以尝试
  if (currentUrl && imgStatus !== 'error') {
    return (
      <div className={cn("relative", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentUrl} // 关键：确保 URL 变化时重新创建元素
          src={currentUrl}
          alt={symbol}
          className={cn(
            "rounded-full w-full h-full object-cover",
            imgStatus !== 'loaded' && "opacity-0 absolute"
          )}
          onError={handleError}
          onLoad={handleLoad}
        />
        {/* 加载中或加载失败时显示占位符 */}
        {imgStatus !== 'loaded' && (
          <GenericTokenIcon symbol={symbol} className="w-full h-full" />
        )}
      </div>
    );
  }

  // 所有来源都失败或没有 URL，显示通用图标
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
    case "bsc-testnet":
      return (
        <NetworkBinanceSmartChain className={className} variant="branded" />
      );
    case "arbitrum-one":
      return <NetworkArbitrumOne className={className} variant="branded" />;
    case "ethereum":
    case "localnet":
      return <NetworkEthereum className={className} variant="branded" />;
    default:
      // Fallback to generic chain icon (no dynamic NetworkIcon)
      return <GenericChainIcon className={className} />;
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
  const [selectedChainForImport, setSelectedChainForImport] =
    useState(activeChain);

  // Update selected chain when activeChain changes
  useEffect(() => {
    setSelectedChainForImport(activeChain);
  }, [activeChain]);

  // Validate address format
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(customAddress);
  const tokenAddress = isValidAddress
    ? (customAddress as `0x${string}`)
    : undefined;

  // Get numeric chain ID for the selected chain
  const selectedNumericChainId = getChainNumericId(selectedChainForImport);

  // Auto-fetch token info when address is valid (use selected chain, not wallet chain)
  const {
    name,
    symbol,
    decimals,
    isLoading: tokenLoading,
    isValid: tokenValid,
  } = useTokenInfo(tokenAddress, selectedNumericChainId);

  // Fetch user balance on the selected chain
  const { data: balance } = useTokenBalance(
    tokenAddress,
    address,
    selectedNumericChainId
  );

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
      (c) =>
        c.contractAddress?.toLowerCase() === customAddress.toLowerCase() &&
        c.chainId === selectedChainForImport
    );
    if (exists) {
      setAddressError(t("form.assetSelector.currencyExists"));
      return;
    }

    // Generate icon URL from Trust Wallet assets
    const iconUrl = getTokenIconUrl(customAddress, selectedChainForImport);

    const newCurrency: Currency = {
      // eslint-disable-next-line react-hooks/purity
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
            className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-1/2 left-1/2 z-60 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              {/* Header */}
              <div className="relative border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                <div className="absolute inset-0 bg-linear-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-linear-to-br from-cyan-500 to-blue-500 p-2.5 shadow-lg shadow-cyan-500/30">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        {t("form.assetSelector.addCustomTitle")}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {t("form.customToken.inputHint")}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClose}
                    className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5 text-slate-500" />
                  </motion.button>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-5 p-6">
                {/* Chain Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400">
                    {t("form.customToken.selectChain")}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {defaultChains.map((chain) => (
                      <button
                        key={chain.id}
                        onClick={() => setSelectedChainForImport(chain.id)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all duration-200",
                          selectedChainForImport === chain.id
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10"
                            : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                        )}
                      >
                        <ChainIcon symbol={chain.id} className="h-6 w-6" />
                        <span className="w-full truncate text-center text-[10px] text-slate-600 dark:text-slate-400">
                          {chain.name.length > 8
                            ? chain.name.slice(0, 8) + "..."
                            : chain.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400">
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
                      "h-12 rounded-xl border-slate-200 bg-slate-50 font-mono text-sm dark:border-slate-700 dark:bg-slate-800",
                      addressError && "border-red-500"
                    )}
                  />
                  {addressError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 text-xs text-red-500"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      {addressError}
                    </motion.div>
                  )}
                </div>

                {/* Token Info Preview */}
                {isValidAddress && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {tokenLoading ? (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        <span className="text-sm text-slate-500">
                          {t("form.customToken.fetchingInfo")}
                        </span>
                      </div>
                    ) : tokenValid ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500">
                            <span className="text-sm font-bold text-white">
                              {symbol?.slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {symbol}
                            </div>
                            <div className="text-sm text-slate-500">{name}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                          <span className="flex items-center gap-1.5 text-sm text-slate-500">
                            <Wallet className="h-4 w-4" />
                            {t("form.customToken.yourBalance")}
                          </span>
                          <span className="font-mono font-medium text-slate-900 dark:text-white">
                            {formatBalance(
                              balance as bigint | undefined,
                              decimals
                            )}{" "}
                            {symbol}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>
                            {t("form.customToken.decimals").replace(
                              "{decimals}",
                              String(decimals)
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-2 text-red-500">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">
                          {t("form.customToken.invalidToken")}
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}

                <Button
                  onClick={handleAdd}
                  disabled={!tokenValid || tokenLoading}
                  className="h-12 w-full rounded-xl bg-linear-to-r from-cyan-500 to-blue-500 font-bold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50"
                >
                  {tokenLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("form.customToken.fetching")}
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
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
    const chainConfig = defaultChains.find((c) => c.id === activeChain);
    const numericChainId = chainConfig?.chainId || CHAIN_IDS.HARDHAT;

    // Get default currencies for this specific chain
    const defaultForChain = getCurrenciesForChain(numericChainId);

    // Get custom currencies that were added for this chain
    const chainCustom = customCurrencies.filter(
      (c) => c.chainId === activeChain
    );

    return [...defaultForChain, ...chainCustom];
  }, [activeChain, customCurrencies]);

  // Filtered currencies based on search
  const filteredCurrencies = useMemo(() => {
    if (!searchQuery) return chainCurrencies;
    const q = searchQuery.toLowerCase();
    return chainCurrencies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
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
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
              onClick={onClose}
            />

            {/* Main Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-1/2 left-1/2 z-50 w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2"
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-black/20 dark:border-slate-800 dark:bg-slate-900">
                {/* Header */}
                <div className="relative">
                  <div className="absolute inset-0 bg-linear-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 dark:from-amber-500/20 dark:via-orange-500/20 dark:to-rose-500/20" />
                  <div className="relative flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="rounded-xl bg-linear-to-br from-amber-500 to-orange-500 p-2.5 shadow-lg shadow-amber-500/30">
                        <Coins className="h-5 w-5 text-white" />
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
                      className="rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    </motion.button>
                  </div>
                </div>

                <div className="flex min-h-[400px] flex-col md:flex-row">
                  {/* Left Side - Chains */}
                  <div className="w-full border-b border-slate-200 p-4 md:w-1/3 md:border-r md:border-b-0 dark:border-slate-800">
                    <p className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
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
                            "group relative flex aspect-square flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition-all duration-200",
                            activeChain === chain.id
                              ? "border-amber-500 bg-linear-to-br from-amber-50 to-orange-50 shadow-lg shadow-amber-500/20 dark:from-amber-500/10 dark:to-orange-500/10"
                              : "border-transparent bg-slate-50 hover:border-amber-400 dark:bg-slate-800/50 dark:hover:border-amber-500"
                          )}
                        >
                          {activeChain === chain.id && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-1.5 right-1.5"
                            >
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </div>
                            </motion.div>
                          )}

                          <div
                            className={cn(
                              "mb-1.5 rounded-xl p-2 transition-all",
                              activeChain === chain.id
                                ? "bg-white shadow-md dark:bg-slate-900"
                                : "bg-slate-100 group-hover:bg-white dark:bg-slate-700/50 dark:group-hover:bg-slate-700"
                            )}
                          >
                            <ChainIcon symbol={chain.id} className="h-6 w-6" />
                          </div>
                          <div className="max-w-full truncate px-1 text-xs font-bold text-slate-900 dark:text-white">
                            {chain.name}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Right Side - Currencies */}
                  <div className="flex w-full flex-col md:w-2/3">
                    {/* Search */}
                    <div className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
                      <div className="relative">
                        <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="text"
                          placeholder={t(
                            "form.assetSelector.searchPlaceholder"
                          )}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-10 rounded-xl border-0 bg-slate-100 pl-11 focus:ring-2 focus:ring-amber-500/50 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    {/* Currency List */}
                    <div className="max-h-[350px] flex-1 overflow-y-auto p-4">
                      {filteredCurrencies.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                          <Coins className="mx-auto mb-3 h-12 w-12 opacity-30" />
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
                                "group relative flex items-center gap-3 rounded-xl border-2 p-3 transition-all duration-200",
                                selectedCurrency === currency.symbol
                                  ? "border-amber-500 bg-linear-to-br from-amber-50 to-orange-50 shadow-lg shadow-amber-500/20 dark:from-amber-500/10 dark:to-orange-500/10"
                                  : "border-transparent bg-slate-50 hover:border-amber-400 dark:bg-slate-800/50 dark:hover:border-amber-500"
                              )}
                            >
                              {/* Left: Icon */}
                              <div
                                className={cn(
                                  "shrink-0 rounded-xl p-2 transition-all",
                                  selectedCurrency === currency.symbol
                                    ? "bg-white shadow-md dark:bg-slate-900"
                                    : "bg-slate-100 group-hover:bg-white dark:bg-slate-700/50 dark:group-hover:bg-slate-700"
                                )}
                              >
                                <CurrencyIcon
                                  symbol={currency.symbol}
                                  className="h-6 w-6"
                                  iconUrl={currency.iconUrl}
                                  contractAddress={currency.contractAddress}
                                  chainId={currency.chainId}
                                  isNative={currency.isNative}
                                />
                              </div>

                              {/* Middle: Info */}
                              <div className="min-w-0 flex-1 text-left">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                                    {currency.symbol}
                                  </span>
                                  {currency.isCustom && (
                                    <span className="rounded bg-linear-to-r from-blue-500 to-cyan-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                      {t("form.assetSelector.customBadge")}
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {currency.name}
                                </div>
                                {currency.contractAddress && (
                                  <div className="mt-0.5 truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                    {currency.contractAddress.slice(0, 6)}...
                                    {currency.contractAddress.slice(-4)}
                                  </div>
                                )}
                              </div>

                              {/* Right: Balance & Check */}
                              <div className="flex shrink-0 items-center gap-2">
                                {address && currency.contractAddress && (
                                  <TokenBalanceDisplay
                                    tokenAddress={
                                      currency.contractAddress as `0x${string}`
                                    }
                                    userAddress={address}
                                    decimals={currency.decimals || 18}
                                    chainId={getChainNumericId(activeChain)}
                                  />
                                )}
                                {selectedCurrency === currency.symbol && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                  >
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
                                      <Check className="h-3 w-3 text-white" />
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
                        className="group h-10 w-full rounded-xl border-2 border-dashed border-slate-300 text-slate-600 transition-all hover:border-amber-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Plus className="mr-2 h-4 w-4 group-hover:text-amber-500" />
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
