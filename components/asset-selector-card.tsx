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
} from "lucide-react";
import { tokens } from "@web3icons/common/metadata";
import { TokenIcon, NetworkIcon } from "@web3icons/react/dynamic";
import {
  NetworkBinanceSmartChain,
  NetworkXLayer,
  NetworkArbitrumOne,
} from "@web3icons/react";

// Chain type definition
export interface Chain {
  id: string;
  name: string;
  symbol: string;
}

// Currency type definition
export interface Currency {
  id: string;
  name: string;
  symbol: string;
  icon?: ReactNode;
  contractAddress?: string;
  isCustom?: boolean;
  chainId?: string;
}

export const defaultChains: Chain[] = [
  { id: "x-layer", name: "X Layer", symbol: "x-layer" },
  {
    id: "binance-smart-chain",
    name: "BNB Smart Chain",
    symbol: "binance-smart-chain",
  },
  { id: "arbitrum-one", name: "Arbitrum", symbol: "arbitrum-one" },
];

// Default currencies
export const defaultCurrencies: Currency[] = [
  { id: "BTC", name: "Bitcoin", symbol: "BTC" },
  { id: "ETH", name: "Ethereum", symbol: "ETH" },
  { id: "SOL", name: "Solana", symbol: "SOL" },
  { id: "BNB", name: "BNB", symbol: "BNB" },
  { id: "USDT", name: "Tether", symbol: "USDT" },
  { id: "USDC", name: "USD Coin", symbol: "USDC" },
];

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
  return searchTokens(symbol).length > 0;
}

// Check if network icon exists
function hasNetworkIcon(symbol: string): boolean {
  const knownNetworks = ["ethereum", "x-layer", "arbitrum-one"];
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

export function CurrencyIcon({
  symbol,
  className = "w-8 h-8",
}: {
  symbol: string;
  className?: string;
}) {
  if (hasTokenIcon(symbol)) {
    return (
      <TokenIcon
        symbol={symbol.toLowerCase()}
        variant="branded"
        className={className}
      />
    );
  }
  return <GenericTokenIcon symbol={symbol} className={className} />;
}

export function ChainIcon({
  symbol,
  className = "w-8 h-8",
}: {
  symbol: string;
  className?: string;
}) {
  console.log(symbol);
  if (hasNetworkIcon(symbol)) {
    return (
      <NetworkIcon name={symbol} variant="branded" className={className} />
    );
  }
  return <GenericChainIcon symbol={symbol} className={className} />;
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
  const [customSymbol, setCustomSymbol] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [addressError, setAddressError] = useState("");

  const validateAddress = (address: string): boolean => {
    if (!address) return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleAdd = () => {
    if (!customSymbol.trim()) return;

    if (!validateAddress(customAddress)) {
      setAddressError(t("form.assetSelector.invalidAddress"));
      return;
    }

    const exists = existingCurrencies.some(
      (c) => c.symbol.toLowerCase() === customSymbol.toLowerCase(),
    );
    if (exists) {
      setAddressError(t("form.assetSelector.currencyExists"));
      return;
    }

    const newCurrency: Currency = {
      id: `custom-${customSymbol.toUpperCase()}-${Date.now()}`,
      name: customSymbol.toUpperCase(),
      symbol: customSymbol.toUpperCase(),
      contractAddress: customAddress,
      isCustom: true,
      chainId: activeChain,
    };

    onAdd(newCurrency);
    onClose();
  };

  const handleClose = useCallback(() => {
    setCustomSymbol("");
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
                        {t("form.assetSelector.addCurrencySubtitle")}
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
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t("form.assetSelector.currencyCode")}
                  </label>
                  <Input
                    type="text"
                    placeholder={t(
                      "form.assetSelector.currencyCodePlaceholder",
                    )}
                    value={customSymbol}
                    onChange={(e) =>
                      setCustomSymbol(e.target.value.toUpperCase())
                    }
                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                    maxLength={10}
                  />
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
                      setCustomAddress(e.target.value);
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

                <Button
                  onClick={handleAdd}
                  disabled={!customSymbol.trim() || !customAddress.trim()}
                  className="w-full h-12 bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("form.assetSelector.addCurrency")}
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

  // All currencies
  const allCurrencies = useMemo(
    () => [...defaultCurrencies, ...customCurrencies],
    [customCurrencies],
  );

  // Filtered currencies
  const filteredCurrencies = useMemo(() => {
    if (!searchQuery) return allCurrencies;
    const q = searchQuery.toLowerCase();
    return allCurrencies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q),
    );
  }, [allCurrencies, searchQuery]);

  const handleAddCurrency = (currency: Currency) => {
    const updated = [...customCurrencies, currency];
    setCustomCurrencies(updated);
    saveCustomCurrencies(updated);
    onSelectCurrency(currency);
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

                    {/* Currency Grid */}
                    <div className="flex-1 p-4 overflow-y-auto max-h-[350px]">
                      {filteredCurrencies.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                          <Coins className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>{t("form.assetSelector.noResults")}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {filteredCurrencies.map((currency, index) => (
                            <motion.button
                              key={currency.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleSelect(currency)}
                              className={cn(
                                "relative p-3 rounded-xl text-center transition-all duration-200 border-2 group aspect-square flex flex-col items-center justify-center",
                                selectedCurrency === currency.symbol
                                  ? "bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-amber-500 shadow-lg shadow-amber-500/20"
                                  : "bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-amber-400 dark:hover:border-amber-500",
                              )}
                            >
                              {selectedCurrency === currency.symbol && (
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

                              {currency.isCustom && (
                                <div className="absolute top-1.5 left-1.5">
                                  <span className="px-1 py-0.5 text-[8px] font-bold bg-linear-to-r from-blue-500 to-cyan-500 text-white rounded">
                                    {t("form.assetSelector.customBadge")}
                                  </span>
                                </div>
                              )}

                              <div
                                className={cn(
                                  "p-2 rounded-xl mb-1.5 transition-all",
                                  selectedCurrency === currency.symbol
                                    ? "bg-white dark:bg-slate-900 shadow-md"
                                    : "bg-slate-100 dark:bg-slate-700/50 group-hover:bg-white dark:group-hover:bg-slate-700",
                                )}
                              >
                                <CurrencyIcon
                                  symbol={currency.symbol}
                                  className="w-6 h-6"
                                />
                              </div>
                              <div className="font-bold text-slate-900 dark:text-white text-xs">
                                {currency.symbol}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-full px-1">
                                {currency.name}
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
        existingCurrencies={allCurrencies}
        activeChain={activeChain}
      />
    </>
  );
}
