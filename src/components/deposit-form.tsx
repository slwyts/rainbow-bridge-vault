"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Position } from "@/app/page";
import {
  AssetSelectorCard,
  getCurrenciesForChain,
  CurrencyIcon,
  ChainIcon,
  type Currency,
} from "@/components/asset-selector-card";
import {
  Coins,
  DollarSign,
  Zap,
  Crown,
  Shield,
  Clock,
  TrendingUp,
  Lock,
  Sparkles,
  ChevronRight,
  Calendar,
  CheckIcon,
  ChevronsUpDownIcon,
  ChevronsUpDown,
  ArrowRightLeft,
  Settings,
  Vault,
  ExternalLink,
  Loader2,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { parseUnits, formatUnits, decodeEventLog, maxUint256 } from "viem";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { config as wagmiConfig } from "@/lib/web3";
import { warehouseAbi, erc20Abi } from "@/lib/abi";
import {
  CHAIN_IDS,
  CHAIN_CONFIGS,
  getAllChainIds,
  getWarehouseAddress,
  getTokenAddress,
  getChainNumericId,
  getChainStringId,
  getPreferredXWaifuChainId,
  type SupportedChainId,
} from "@/lib/chains";
import {
  useTokenAllowance,
  useTokenDecimals,
  useTokenBalance,
  useNativeBalance,
  calculateFee as calcContractFee,
  calculateLockupFee,
  calculateLockupAmountToSend,
  useWarehouseAddress,
  useBlockchainTime,
  useXwaifuToken,
  isValidVIPLockup,
} from "@/lib/contracts";

interface DepositFormProps {
  onAddPosition: () => void; // Called after successful tx to trigger refetch
  positions: Position[]; // Positions passed from parent for VIP detection
}

export function DepositForm({ onAddPosition, positions }: DepositFormProps) {
  const { t } = useI18n();
  const { isConnected, address } = useAccount();
  const connectedChainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  // Fix hydration mismatch - only use wallet state after client mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get warehouse address for current chain
  const warehouseAddress = useWarehouseAddress();

  // Get blockchain time for accurate unlock time calculation
  const { timestamp: blockchainTime } = useBlockchainTime();

  // VIP 折扣：xwaifu token 地址（positions 从 props 传入）
  const { data: xwaifuTokenAddress } = useXwaifuToken();

  // Transaction states (managed locally instead of via hooks)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVIPLockupProcessing, setIsVIPLockupProcessing] = useState(false);

  const [depositType, setDepositType] = useState<"u-based" | "coin-based">(
    "u-based"
  );
  const [disbursementAmount, setDisbursementAmount] = useState("50");
  const [frequency, setFrequency] = useState("30");
  const [period, setPeriod] = useState("1");

  // 默认选择第一个启用的链
  const defaultChainStringId = getChainStringId(
    getAllChainIds()[0] || CHAIN_IDS.HARDHAT
  );
  const [selectedChain, setSelectedChain] = useState(defaultChainStringId);

  // Get currencies for the selected chain
  const getDefaultCurrency = useCallback((chainStringId: string) => {
    const numericChainId = getChainNumericId(chainStringId);
    const currencies = getCurrenciesForChain(numericChainId);
    // Default to USDT if available, otherwise first currency
    return currencies.find((c) => c.symbol === "USDT") || currencies[0];
  }, []);

  const [selectedCurrency, setSelectedCurrency] = useState(
    () => getDefaultCurrency(defaultChainStringId).symbol
  );
  const [selectedCurrencyData, setSelectedCurrencyData] =
    useState<Currency | null>(() => getDefaultCurrency(defaultChainStringId));
  const [selectedChainSymbol, setSelectedChainSymbol] =
    useState(defaultChainStringId);
  const [amount, setAmount] = useState("");
  const [lockPeriod, setLockPeriod] = useState("30");
  const [unlockDate, setUnlockDate] = useState<number>(() => Date.now());
  const [depositRemittance, setDepositRemittance] = useState(false);
  const [lockupRemittance, setLockupRemittance] = useState(false);

  // 找到支持 VIP 的链上已激活 VIP 的 lockup（用于自动应用折扣）
  // 检查合约 xwaifuToken 是否有效（非零地址）
  const xwaifuAddr = xwaifuTokenAddress
    ? String(xwaifuTokenAddress).toLowerCase()
    : "";
  const hasXwaifuSupport =
    !!xwaifuAddr && xwaifuAddr !== "0x0000000000000000000000000000000000000000";

  const activeVIPLockup = positions.find((p) => {
    if (p.type !== "coin-based") return false;
    if (!hasXwaifuSupport) return false;
    if (p.tokenAddress?.toLowerCase() !== xwaifuAddr) return false;
    if (!p.isDiscountActive) return false;
    if (p.status !== "active") return false;
    if (p.createTime === undefined || p.unlockTime === undefined) return false;
    return isValidVIPLockup(
      BigInt(p.amount),
      p.unlockTime,
      p.createTime,
      p.isDiscountActive,
      false
    );
  });

  // 从 position.id 解析出 lockup index: "lockup-{chainId}-{index}"
  const vipLockupId = activeVIPLockup
    ? BigInt(activeVIPLockup.id.split("-")[2])
    : undefined;

  // 是否有有效 VIP（xwaifuToken 非零地址且有已激活的 VIP lockup）
  const hasVIPDiscount = hasXwaifuSupport && vipLockupId !== undefined;

  // U-based token selection (USDT, USDC, or USDG)
  const [uBasedTokenSymbol, setUBasedTokenSymbol] = useState<
    "USDT" | "USDC" | "USDG"
  >("USDT");

  // Get current chain's token addresses
  const currentNumericChainId = getChainNumericId(selectedChain);

  // Get available stablecoins for current chain
  const availableStablecoins = useMemo(() => {
    const coins: Array<{ symbol: "USDT" | "USDC" | "USDG"; color: string }> =
      [];
    if (getTokenAddress(currentNumericChainId, "USDT")) {
      coins.push({ symbol: "USDT", color: "emerald" });
    }
    if (getTokenAddress(currentNumericChainId, "USDC")) {
      coins.push({ symbol: "USDC", color: "blue" });
    }
    if (getTokenAddress(currentNumericChainId, "USDG")) {
      coins.push({ symbol: "USDG", color: "amber" });
    }
    return coins;
  }, [currentNumericChainId]);

  // Auto-select first available stablecoin when chain changes
  useEffect(() => {
    if (
      availableStablecoins.length > 0 &&
      !availableStablecoins.find((c) => c.symbol === uBasedTokenSymbol)
    ) {
      setUBasedTokenSymbol(availableStablecoins[0].symbol);
    }
  }, [availableStablecoins, uBasedTokenSymbol]);

  const uBasedToken = getTokenAddress(
    currentNumericChainId,
    uBasedTokenSymbol
  ) as `0x${string}` | undefined;
  const currentWarehouseAddress = getWarehouseAddress(currentNumericChainId);

  // For coin-based, get the selected token from selectedCurrencyData
  const selectedTokenAddress = selectedCurrencyData?.contractAddress as
    | `0x${string}`
    | undefined;

  // Dynamically fetch token decimals
  const { data: uBasedTokenDecimals } = useTokenDecimals(uBasedToken);
  const { data: selectedTokenDecimals } =
    useTokenDecimals(selectedTokenAddress);

  // Use fetched decimals or fallback to common defaults
  const uBasedDecimals =
    typeof uBasedTokenDecimals === "number" ? uBasedTokenDecimals : 6;
  const lockupTokenDecimals =
    selectedCurrencyData?.decimals ||
    (typeof selectedTokenDecimals === "number" ? selectedTokenDecimals : 18);

  // Check allowance for U-based deposits
  const { data: uBasedAllowance, refetch: refetchUBasedAllowance } =
    useTokenAllowance(uBasedToken, address, currentWarehouseAddress);

  // Check allowance for coin-based lockups
  const { data: lockupAllowance, refetch: refetchLockupAllowance } =
    useTokenAllowance(selectedTokenAddress, address, currentWarehouseAddress);

  // Fetch token balances
  const { data: uBasedBalance } = useTokenBalance(uBasedToken, address);
  const { data: lockupTokenBalance } = useTokenBalance(
    selectedTokenAddress,
    address
  );

  // Fetch native token balance (for ETH, BNB, OKB, etc.)
  const { data: nativeBalanceData } = useNativeBalance(address);

  // Determine if selected currency is native
  const isNativeToken = selectedCurrencyData?.isNative === true;

  // Get the actual lockup balance based on token type
  const actualLockupBalance = isNativeToken
    ? nativeBalanceData?.value
    : lockupTokenBalance;

  // Calculate if user has sufficient balance
  const getUBasedTotalNeeded = () => {
    const amt = Number.parseFloat(disbursementAmount) || 0;
    const freq = Number.parseInt(frequency) || 0;
    const totalPrincipal = amt * freq;
    let fee = calcContractFee(
      parseUnits(totalPrincipal.toString(), uBasedDecimals),
      freq
    );
    // VIP 折扣
    if (hasVIPDiscount) {
      fee = fee / 2n;
    }
    return parseUnits(totalPrincipal.toString(), uBasedDecimals) + fee;
  };

  const getLockupTotalNeeded = () => {
    const amt = Number.parseFloat(amount) || 0;
    if (amt <= 0) return 0n;
    const desiredAmount = parseUnits(amt.toString(), lockupTokenDecimals);
    // 反算：用户输入的是期望仓位，计算需要支付的金额
    return calculateLockupAmountToSend(desiredAmount, hasVIPDiscount);
  };

  const uBasedTotalNeeded = getUBasedTotalNeeded();
  const lockupTotalNeeded = getLockupTotalNeeded();

  const hasInsufficientUBasedBalance =
    uBasedBalance !== undefined &&
    typeof uBasedBalance === "bigint" &&
    uBasedTotalNeeded > uBasedBalance;

  const hasInsufficientLockupBalance =
    actualLockupBalance !== undefined &&
    typeof actualLockupBalance === "bigint" &&
    lockupTotalNeeded > actualLockupBalance;

  // Update currency when chain changes
  useEffect(() => {
    const newDefaultCurrency = getDefaultCurrency(selectedChain);
    setSelectedCurrency(newDefaultCurrency.symbol);
    setSelectedCurrencyData(newDefaultCurrency);
  }, [selectedChain, getDefaultCurrency]);

  useEffect(() => {
    // Use blockchain time if available, fallback to local time
    const baseTime = blockchainTime ? blockchainTime * 1000 : Date.now();
    setUnlockDate(baseTime + Number.parseInt(lockPeriod) * 24 * 60 * 60 * 1000);
  }, [lockPeriod, blockchainTime]);

  const validateDisbursementAmount = (value: string) => {
    const amount = Number.parseFloat(value);
    if (depositType === "u-based" && !Number.isNaN(amount) && amount <= 4) {
      setDisbursementError(t("validation.minDisbursementAmount"));
    } else {
      setDisbursementError("");
    }
  };

  const [chainOpen, setChainOpen] = useState(false);
  const [assetSelectorOpen, setAssetSelectorOpen] = useState(false);
  const [customPeriodOpen, setCustomPeriodOpen] = useState(false);
  const [customPeriodValue, setCustomPeriodValue] = useState("");
  const [disbursementError, setDisbursementError] = useState("");

  const [customLockPeriodOpen, setCustomLockPeriodOpen] = useState(false);
  const [customLockPeriodValue, setCustomLockPeriodValue] = useState("");

  const quickAmounts = ["10", "20", "30", "50", "100"];

  // 从统一配置生成链列表（带UI图标）
  const chains = getAllChainIds().map((chainId) => {
    const config = CHAIN_CONFIGS[chainId as SupportedChainId];
    return {
      id: config.stringId,
      name: config.name,
      icon: <ChainIcon symbol={config.stringId} className="h-5 w-5" />,
      gas: config.gasEstimate,
      gasLevel: config.gasLevel,
      symbol: config.stringId,
      chainId: config.chainId,
    };
  });

  // Get expected chainId for selected chain
  const expectedChainId =
    chains.find((c) => c.id === selectedChain)?.chainId ?? CHAIN_IDS.HARDHAT;
  const isWrongChainForSelected =
    isConnected && connectedChainId !== expectedChainId;

  // Switch to the selected chain
  const handleSwitchChain = async () => {
    try {
      await switchChain({ chainId: expectedChainId });
    } catch (err) {
      toast.error(t("form.errors.switchNetworkFailed"), {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const calculateTotal = () => {
    const amt = Number.parseFloat(disbursementAmount) || 0;
    const freq = Number.parseInt(frequency) || 0;
    return (amt * freq).toFixed(2);
  };

  const calculateFee = () => {
    const total = Number.parseFloat(calculateTotal()) || 0;
    const freq = Number.parseInt(frequency) || 0;

    let baseFeeRate = 0.005;
    if (freq >= 11 && freq <= 30) baseFeeRate = 0.008;
    if (freq >= 31 && freq <= 100) baseFeeRate = 0.01;
    if (freq >= 101) baseFeeRate = 0.02;

    let baseFee = total * baseFeeRate;

    // VIP 折扣 50%
    const originalFee = baseFee;
    const originalFeeRate = baseFeeRate;
    if (hasVIPDiscount) {
      baseFee = baseFee / 2;
      baseFeeRate = baseFeeRate / 2;
    }

    return {
      baseFee: baseFee.toFixed(2),
      originalFee: originalFee.toFixed(2),
      disbursementFee: "0.00",
      total: baseFee.toFixed(2),
      hasDiscount: hasVIPDiscount,
      feeRate: (baseFeeRate * 100).toFixed(2) + "%",
      originalFeeRate: (originalFeeRate * 100).toFixed(2) + "%",
    };
  };

  const handleCreateDeposit = async () => {
    try {
      if (!address) throw new Error(t("form.errors.connectWalletFirst"));

      if (connectedChainId !== expectedChainId) {
        await switchChain?.({ chainId: expectedChainId });
      }

      validateDisbursementAmount(disbursementAmount);

      const amountNum = Number.parseFloat(disbursementAmount);
      if (
        depositType === "u-based" &&
        !Number.isNaN(amountNum) &&
        amountNum <= 4
      ) {
        return;
      }

      if (!uBasedToken) {
        toast.error("Token not configured", {
          description: "Please check .env.local configuration",
        });
        return;
      }

      const totalPeriods = Number.parseInt(frequency);
      const periodSeconds = Number.parseInt(period) * 24 * 60 * 60; // Convert days to seconds
      const amountPerPeriod = parseUnits(disbursementAmount, uBasedDecimals);
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      let fee = calcContractFee(totalAmount, totalPeriods);
      // VIP 折扣：手续费减半
      if (hasVIPDiscount) {
        fee = fee / 2n;
      }
      const totalNeeded = totalAmount + fee;

      setIsSubmitting(true);

      try {
        // Check if we need approval
        const currentAllowance =
          typeof uBasedAllowance === "bigint" ? uBasedAllowance : 0n;
        if (currentAllowance < totalNeeded) {
          toast.info(`Approving ${uBasedTokenSymbol}...`, {
            description: "Please confirm the approval transaction",
          });

          if (!currentWarehouseAddress || !uBasedToken) {
            throw new Error("Warehouse or token not configured for this chain");
          }

          // Step 1: Send approve transaction using wagmi core action
          const approveHash = await writeContract(wagmiConfig, {
            address: uBasedToken,
            abi: erc20Abi,
            functionName: "approve",
            args: [currentWarehouseAddress, totalNeeded],
          });

          // Step 2: Wait for approval tx to be confirmed on chain
          toast.info("Waiting for approval confirmation...", {
            description: "Please wait while the transaction is being confirmed",
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
          await refetchUBasedAllowance();
          toast.success(`${uBasedTokenSymbol} Approved!`, {
            description: "Now creating deposit...",
          });
        }

        if (!currentWarehouseAddress || !uBasedToken) {
          throw new Error("Warehouse or token not configured for this chain");
        }

        // Step 3: Send deposit transaction
        toast.info("Creating deposit...", {
          description: "Please confirm the transaction in your wallet",
        });
        const depositHash = await writeContract(wagmiConfig, {
          address: currentWarehouseAddress,
          abi: warehouseAbi,
          functionName: "createDeposit",
          args: [
            uBasedToken,
            amountPerPeriod,
            BigInt(periodSeconds),
            totalPeriods,
            vipLockupId ?? maxUint256, // 无 VIP 时传 maxUint256 跳过折扣检查
            depositRemittance,
          ],
        });

        // Step 4: Wait for deposit confirmation
        toast.info("Waiting for deposit confirmation...", {
          description: "Please wait while the transaction is being confirmed",
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: depositHash });

        // Refetch allowance after deposit (transferFrom consumes allowance)
        await refetchUBasedAllowance();

        toast.success(t("toast.depositCreated.title"), {
          description: "Deposit created successfully!",
        });
        onAddPosition();
      } finally {
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Please try again";
      toast.error("Transaction failed", {
        description: errorMessage,
      });
    }
  };

  const handleLockDeposit = async () => {
    const isNativeToken = selectedCurrencyData?.isNative === true;

    if (connectedChainId !== expectedChainId) {
      await switchChain?.({ chainId: expectedChainId });
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      toast.error("Invalid amount", {
        description: "Please enter a valid amount",
      });
      return;
    }

    // 用户输入的是期望仓位金额
    const desiredAmount = parseUnits(amount, lockupTokenDecimals);
    // 反算需要传给合约的金额
    const amountToSend = calculateLockupAmountToSend(desiredAmount, hasVIPDiscount);
    const unlockTimestamp = BigInt(Math.floor(unlockDate / 1000));

    // For native tokens, use address(0)
    const tokenAddressForContract = isNativeToken
      ? ("0x0000000000000000000000000000000000000000" as `0x${string}`)
      : selectedTokenAddress!;

    setIsSubmitting(true);

    try {
      if (!currentWarehouseAddress) {
        throw new Error("Warehouse not configured for this chain");
      }

      // For ERC20 tokens, always refetch allowance and approve if needed
      if (!isNativeToken) {
        // Force refetch to get latest on-chain allowance
        const { data: freshAllowance } = await refetchLockupAllowance();
        const currentLockupAllowance =
          typeof freshAllowance === "bigint" ? freshAllowance : 0n;

        if (currentLockupAllowance < amountToSend) {
          toast.info(`Approving ${selectedCurrency}...`, {
            description: "Please confirm the approval transaction",
          });

          // Step 1: Send approve transaction
          const approveHash = await writeContract(wagmiConfig, {
            address: selectedTokenAddress!,
            abi: erc20Abi,
            functionName: "approve",
            args: [currentWarehouseAddress, amountToSend],
          });

          // Step 2: Wait for approval confirmation
          toast.info("Waiting for approval confirmation...", {
            description: "Please wait while the transaction is being confirmed",
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
          await refetchLockupAllowance();
          toast.success(`${selectedCurrency} Approved!`, {
            description: "Now creating lockup...",
          });
        }
      }

      // Step 3: Send lockup transaction
      toast.info("Creating lockup...", {
        description: "Please confirm the transaction in your wallet",
      });

      const lockupHash = await writeContract(wagmiConfig, {
        address: currentWarehouseAddress,
        abi: warehouseAbi,
        functionName: "createLockup",
        args: [
          tokenAddressForContract,
          amountToSend, // 传反算后的金额，合约扣费后仓位 = 用户期望值
          unlockTimestamp,
          vipLockupId ?? maxUint256, // 无 VIP 时传 maxUint256 跳过折扣检查
          lockupRemittance,
        ],
        // For native tokens, send the value with the transaction
        ...(isNativeToken ? { value: amountToSend } : {}),
      });

      // Step 4: Wait for lockup confirmation
      toast.info("Waiting for lockup confirmation...", {
        description: "Please wait while the transaction is being confirmed",
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: lockupHash });

      // Refetch allowance after lockup (transferFrom consumes allowance)
      if (!isNativeToken) {
        await refetchLockupAllowance();
      }

      toast.success(t("toast.depositLocked.title"), {
        description: "Lockup created successfully!",
      });
      onAddPosition();
    } catch (err: unknown) {
      // Try to extract detailed error message
      let errorMessage = "Please try again";
      if (err instanceof Error) {
        errorMessage = err.message;
        // Check for shortMessage (viem errors)
        if ("shortMessage" in err) {
          errorMessage = (err as { shortMessage: string }).shortMessage;
        }
      }

      toast.error("Transaction failed", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChainChange = (chainStringId: string) => {
    setSelectedChain(chainStringId);
    const chain = chains.find((c) => c.id === chainStringId);
    if (chain) {
      setSelectedChainSymbol(chain.symbol);
    }

    // Auto switch chain when user selects a different chain
    const targetChain = chains.find((c) => c.id === chainStringId);
    if (
      targetChain &&
      isConnected &&
      connectedChainId !== targetChain.chainId
    ) {
      // wagmi 的 switchChain 会自动处理添加网络（如果钱包不存在该链）
      switchChain(
        { chainId: targetChain.chainId },
        {
          onError: (err) => {
            toast.error(t("form.errors.switchNetworkFailed"), {
              description:
                err instanceof Error ? err.message : "Please try again",
            });
          },
        }
      );
    }
  };

  // 一键开通 VIP：锁仓 10000 xWAIFU 365天 + 激活 VIP
  const handleOneClickVIP = async () => {
    if (!address) {
      toast.error(t("form.errors.connectWalletFirst"));
      return;
    }

    // 获取首选的支持 xWAIFU 的链（优先当前链）
    const preferredChainId = getPreferredXWaifuChainId(connectedChainId);
    if (!preferredChainId) {
      toast.error(t("form.vip.noSupportedChain"));
      return;
    }

    setIsVIPLockupProcessing(true);

    try {
      // 1. 如果当前链不支持 xWAIFU，切换到支持的链
      if (connectedChainId !== preferredChainId) {
        toast.info(t("form.vip.switchingChain"), {
          description: CHAIN_CONFIGS[preferredChainId].name,
        });
        await switchChain?.({ chainId: preferredChainId });
        // 等待链切换完成
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const targetChainId = preferredChainId;
      const xwaifuAddress = getTokenAddress(targetChainId, "XWAIFU");
      const warehouseAddr = getWarehouseAddress(targetChainId);

      if (!xwaifuAddress || !warehouseAddr) {
        throw new Error(t("form.vip.configError"));
      }

      // VIP 要求：最终仓位 >= 9800 xWAIFU，激活需要扣 100 xWAIFU
      // 期望仓位 10000，激活后剩余 9900，满足 >= 9800 要求
      const VIP_DESIRED_AMOUNT = parseUnits("10000", 18); // 期望仓位 10000
      const VIP_LOCK_DAYS = 365;
      // 反算需要传给合约的金额（无 VIP 折扣，因为这是首次开通）
      const VIP_AMOUNT_TO_SEND = calculateLockupAmountToSend(VIP_DESIRED_AMOUNT, false);

      // 计算解锁时间戳 - 使用区块链时间（支持时间加速测试）
      const baseTimestamp = blockchainTime ?? Math.floor(Date.now() / 1000);
      const unlockTimestamp = BigInt(
        baseTimestamp + VIP_LOCK_DAYS * 24 * 60 * 60
      );

      // 2. Approve（锁仓所需的金额）
      toast.info(t("form.vip.checkingApproval"));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const approveHash = await writeContract(wagmiConfig as any, {
        address: xwaifuAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [warehouseAddr, VIP_AMOUNT_TO_SEND],
        chainId: targetChainId,
      });

      toast.info(t("form.vip.waitingApproval"));
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

      // 3. 创建 lockup
      toast.info(t("form.vip.creatingLockup"), {
        description: `10,000 xWAIFU × ${VIP_LOCK_DAYS} ${t("form.days")}`,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lockupHash = await writeContract(wagmiConfig as any, {
        address: warehouseAddr,
        abi: warehouseAbi,
        functionName: "createLockup",
        args: [
          xwaifuAddress,
          VIP_AMOUNT_TO_SEND, // 反算后的金额，合约扣费后仓位 = 10000
          unlockTimestamp,
          maxUint256, // 不使用现有 VIP 折扣，传入 uint256.max 跳过折扣检查
          false, // 不开启汇付
        ],
        chainId: targetChainId,
      });

      toast.info(t("form.vip.waitingConfirmation"));
      const lockupReceipt = await waitForTransactionReceipt(wagmiConfig, {
        hash: lockupHash,
      });

      // 4. 从交易回执中解析 LockupCreated 事件获取 lockup ID
      let lockupId: bigint | undefined;
      for (const log of lockupReceipt.logs) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const decoded = decodeEventLog({
            abi: warehouseAbi as any,
            data: log.data,
            topics: log.topics,
          }) as { eventName: string; args: { id: bigint } };
          if (decoded.eventName === "LockupCreated") {
            lockupId = decoded.args.id;
            break;
          }
        } catch {
          // 不是我们要找的事件，继续
        }
      }

      if (lockupId === undefined) {
        throw new Error(t("form.vip.lockupIdNotFound"));
      }

      // 5. 激活 VIP（燃烧 100 xWAIFU）
      toast.info(t("form.vip.activatingVIP"), {
        description: t("form.vip.burning100"),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activateHash = await writeContract(wagmiConfig as any, {
        address: warehouseAddr,
        abi: warehouseAbi,
        functionName: "activateVIP",
        args: [lockupId],
        chainId: targetChainId,
      });

      toast.info(t("form.vip.waitingActivation"));
      await waitForTransactionReceipt(wagmiConfig, { hash: activateHash });

      toast.success(t("form.vip.success"), {
        description: t("form.vip.successDescFull"),
      });

      // 6. 刷新仓位
      onAddPosition();
    } catch (err) {
      const errorMessage =
        (err as { shortMessage?: string })?.shortMessage ||
        (err instanceof Error ? err.message : "Please try again");
      toast.error(t("form.vip.failed"), {
        description: errorMessage,
      });
    } finally {
      setIsVIPLockupProcessing(false);
    }
  };

  const selectedChainData = chains.find((c) => c.id === selectedChain);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AssetSelectorCard
        isOpen={assetSelectorOpen}
        onClose={() => setAssetSelectorOpen(false)}
        selectedCurrency={selectedCurrency}
        onSelectCurrency={(currency) => {
          setSelectedCurrency(currency.symbol);
          setSelectedCurrencyData(currency);
        }}
        selectedChain={selectedChain}
        onSelectChain={handleChainChange}
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/50 bg-white/70 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/70">
        {/* Terminal-style header */}
        <div className="flex items-center justify-between border-b border-slate-200/50 bg-white/70 px-4 py-4 sm:px-6 dark:border-slate-700/50 dark:bg-slate-800/70">
          <div className="hidden items-center gap-3 sm:flex">
            <Vault className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
              Bifrost Fund Diversion
            </span>
            {/* Show actual wallet chain - only after mount to prevent hydration mismatch */}
            {mounted && isConnected && (
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  isWrongChainForSelected
                    ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                }`}
              >
                Wallet:{" "}
                {chains.find((c) => c.chainId === connectedChainId)?.name ||
                  `Chain ${connectedChainId}`}
              </span>
            )}
          </div>
          <div className="flex w-full items-center gap-4 sm:w-auto">
            <Popover open={chainOpen} onOpenChange={setChainOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={chainOpen}
                  className="h-10 w-full justify-between rounded-lg border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 sm:w-[240px] dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                >
                  {selectedChainData ? (
                    <span className="flex items-center gap-2">
                      {selectedChainData.icon}
                      <span>{selectedChainData.name}</span>
                      <span className="text-xs text-slate-400">
                        ({selectedChainData.gas})
                      </span>
                    </span>
                  ) : (
                    t("form.combobox.selectChain")
                  )}
                  <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[260px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <Command className="bg-transparent">
                  <CommandList>
                    <CommandEmpty className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t("form.combobox.noChainFound")}
                    </CommandEmpty>
                    <CommandGroup className="p-1">
                      {chains.map((chain) => (
                        <CommandItem
                          key={chain.id}
                          value={chain.id}
                          onSelect={(currentValue) => {
                            if (currentValue !== selectedChain) {
                              handleChainChange(currentValue);
                            }
                            setChainOpen(false);
                          }}
                          className="cursor-pointer rounded-lg px-3 py-2.5 text-slate-700 hover:bg-slate-100 data-[selected=true]:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 dark:data-[selected=true]:bg-slate-700"
                        >
                          <CheckIcon
                            className={cn(
                              "mr-2 h-4 w-4 text-violet-500",
                              selectedChain === chain.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span className="mr-2">{chain.icon}</span>
                          <span className="font-medium">{chain.name}</span>
                          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                            {chain.gas}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <Tabs
            value={depositType}
            onValueChange={(value) => {
              setDepositType(value as "u-based" | "coin-based");
              if (value === "u-based") {
                validateDisbursementAmount(disbursementAmount);
              } else {
                setDisbursementError("");
              }
            }}
            className="w-full"
          >
            <TabsList className="grid h-14 w-full grid-cols-2 rounded-xl bg-slate-100 p-1.5 sm:h-16 dark:bg-slate-800/50">
              <TabsTrigger
                value="u-based"
                className="h-full gap-2 rounded-lg font-semibold text-slate-500 transition-all duration-300 data-[state=active]:bg-linear-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-500 data-[state=active]:text-white dark:text-slate-400"
              >
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("form.tabs.uBased")}
                </span>
                <span className="sm:hidden">U-Based</span>
              </TabsTrigger>
              <TabsTrigger
                value="coin-based"
                className="h-full gap-2 rounded-lg font-semibold text-slate-500 transition-all duration-300 data-[state=active]:bg-linear-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white dark:text-slate-400"
              >
                <Coins className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("form.tabs.coinBased")}
                </span>
                <span className="sm:hidden">Coin</span>
              </TabsTrigger>
            </TabsList>

            {/* U-Based Content */}
            <TabsContent value="u-based" className="mt-6" forceMount>
              <motion.div
                key="u-based"
                initial={{ opacity: 0, x: -20 }}
                animate={{
                  opacity: depositType === "u-based" ? 1 : 0,
                  x: depositType === "u-based" ? 0 : -20,
                }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className={depositType !== "u-based" ? "hidden" : ""}
              >
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Left Column - Main Form */}
                  <div className="space-y-6 lg:col-span-2">
                    {/* Amount Row */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Disbursement Amount */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                          <DollarSign className="h-3 w-3" />
                          {t("form.labels.disbursementAmount")}
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={disbursementAmount}
                            onChange={(e) => {
                              setDisbursementAmount(e.target.value);
                              validateDisbursementAmount(e.target.value);
                            }}
                            className={`h-14 rounded-xl border-slate-300 bg-slate-100 pr-24 pl-4 text-xl font-bold text-slate-800 focus:ring-emerald-500/20 sm:text-2xl dark:border-slate-600 dark:bg-slate-800/50 dark:text-white ${
                              disbursementError
                                ? "border-red-500 focus:border-red-500"
                                : "focus:border-emerald-500"
                            }`}
                          />
                          {/* Stablecoin Selector */}
                          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
                            {availableStablecoins.map((coin) => (
                              <button
                                key={coin.symbol}
                                type="button"
                                onClick={() =>
                                  setUBasedTokenSymbol(coin.symbol)
                                }
                                className={`rounded px-2 py-1 text-xs font-bold transition-all ${
                                  uBasedTokenSymbol === coin.symbol
                                    ? `bg-${coin.color}-500 text-white`
                                    : "bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
                                }`}
                                style={
                                  uBasedTokenSymbol === coin.symbol
                                    ? {
                                        backgroundColor:
                                          coin.color === "emerald"
                                            ? "#10b981"
                                            : coin.color === "blue"
                                              ? "#3b82f6"
                                              : coin.color === "amber"
                                                ? "#f59e0b"
                                                : "#10b981",
                                      }
                                    : undefined
                                }
                              >
                                {coin.symbol}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Balance display for U-based */}
                        {isConnected && uBasedBalance !== undefined && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                              <Wallet className="h-3 w-3" />
                              {t("form.balance.label")}
                            </span>
                            <span
                              className={`font-mono ${hasInsufficientUBasedBalance ? "text-red-500" : "text-slate-600 dark:text-slate-300"}`}
                            >
                              {typeof uBasedBalance === "bigint"
                                ? Number(
                                    formatUnits(uBasedBalance, uBasedDecimals)
                                  ).toLocaleString(undefined, {
                                    maximumFractionDigits: 4,
                                  })
                                : "0"}{" "}
                              {uBasedTokenSymbol}
                            </span>
                          </div>
                        )}
                        {disbursementError && (
                          <div className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-500 dark:bg-red-500/10">
                            {disbursementError}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {quickAmounts.map((amt) => (
                            <button
                              key={amt}
                              onClick={() => {
                                setDisbursementAmount(amt);
                                validateDisbursementAmount(amt);
                              }}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                disbursementAmount === amt
                                  ? "bg-emerald-500 text-white"
                                  : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-600"
                              }`}
                            >
                              {amt}U
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Frequency */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                          <Clock className="h-3 w-3" />
                          {t("form.labels.disbursementFrequency")}
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value)}
                            max="365"
                            className="h-14 rounded-xl border-slate-300 bg-slate-100 pr-16 pl-4 text-xl font-bold text-slate-800 focus:border-violet-500 focus:ring-violet-500/20 sm:text-2xl dark:border-slate-600 dark:bg-slate-800/50 dark:text-white"
                          />
                          <span className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-bold text-violet-500 dark:text-violet-400">
                            {t("form.frequency.times")}
                          </span>
                        </div>
                        <p className="dark:text-white-500 text-xs text-slate-400">
                          {t("form.hints.maxFrequency")}
                        </p>
                      </div>
                    </div>

                    {/* Period Selector */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                        <Shield className="h-3 w-3" />
                        {t("form.labels.periodDays")}
                      </label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          {
                            value: "1",
                            label: t("form.periods.daily"),
                            desc: t("form.periods.dailyDesc"),
                          },
                          {
                            value: "7",
                            label: t("form.periods.weekly"),
                            desc: t("form.periods.weeklyDesc"),
                          },
                          {
                            value: "30",
                            label: t("form.periods.monthly"),
                            desc: t("form.periods.monthlyDesc"),
                          },
                        ].map((p) => (
                          <button
                            key={p.value}
                            onClick={() => setPeriod(p.value)}
                            className={`rounded-xl border p-3 text-left transition-all sm:p-4 ${
                              period === p.value
                                ? "border-violet-500 bg-violet-500/20 text-violet-700 dark:text-white"
                                : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400 dark:hover:bg-slate-700/50"
                            }`}
                          >
                            <div className="text-sm font-bold">{p.label}</div>
                            <div className="text-xs opacity-60">{p.desc}</div>
                          </button>
                        ))}
                        {/* Custom Period with Popover */}
                        <Popover
                          open={customPeriodOpen}
                          onOpenChange={setCustomPeriodOpen}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className={`rounded-xl border p-3 text-left transition-all sm:p-4 ${
                                !["1", "7", "30"].includes(period)
                                  ? "border-violet-500 bg-violet-500/20 text-violet-700 dark:text-white"
                                  : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400 dark:hover:bg-slate-700/50"
                              }`}
                            >
                              <div className="flex items-center gap-1 text-sm font-bold">
                                <Settings className="h-3 w-3" />
                                {t("form.periods.custom")}
                              </div>
                              <div className="text-xs opacity-60">
                                {!["1", "7", "30"].includes(period)
                                  ? `${period} days`
                                  : t("form.periods.customDesc")}
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-slate-800 dark:text-white">
                                {t("form.periods.customTitle")}
                              </h4>
                              <Input
                                type="number"
                                placeholder={t(
                                  "form.periods.customPlaceholder"
                                )}
                                value={customPeriodValue}
                                onChange={(e) =>
                                  setCustomPeriodValue(e.target.value)
                                }
                                className="h-10 border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                              />
                              <Button
                                onClick={() => {
                                  if (
                                    customPeriodValue &&
                                    Number.parseInt(customPeriodValue) > 0
                                  ) {
                                    setPeriod(customPeriodValue);
                                    setCustomPeriodOpen(false);
                                  }
                                }}
                                className="w-full bg-violet-500 text-white hover:bg-violet-600"
                              >
                                {t("form.periods.customConfirm")}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Featured Products */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                          {t("form.labels.featuredProducts")}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* War God */}
                        <button
                          onClick={() => {
                            setDisbursementAmount("10");
                            setFrequency("7");
                            setPeriod("1");
                          }}
                          className="group relative rounded-xl border border-red-300 bg-linear-to-br from-red-100 to-orange-100 p-4 transition-all hover:scale-[1.02] hover:border-red-500/60 sm:p-5 dark:border-red-500/30 dark:from-red-900/30 dark:to-orange-900/30"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex flex-col items-start">
                              <div className="mb-2 flex items-center gap-2">
                                <Zap className="h-5 w-5 text-red-500 dark:text-red-400" />
                                <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                                  {t("form.products.warrior.badge")}
                                </span>
                              </div>
                              <h4 className="text-left text-base font-bold text-slate-800 sm:text-lg dark:text-white">
                                {t("form.products.warrior.name")}
                              </h4>
                              <p className="text-left text-sm text-slate-500 dark:text-slate-400">
                                10U × 7 {t("form.products.days")}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-red-400 dark:text-slate-600" />
                          </div>
                        </button>

                        {/* Premium */}
                        <button
                          onClick={() => {
                            setDisbursementAmount("50");
                            setFrequency("30");
                            setPeriod("1");
                          }}
                          className="group relative rounded-xl border border-violet-300 bg-linear-to-br from-violet-100 to-purple-100 p-4 transition-all hover:scale-[1.02] hover:border-violet-500/60 sm:p-5 dark:border-violet-500/30 dark:from-violet-900/30 dark:to-purple-900/30"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex flex-col items-start">
                              <div className="mb-2 flex items-center gap-2">
                                <Crown className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                                <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-bold text-violet-600 dark:text-violet-400">
                                  {t("form.products.premium.badge")}
                                </span>
                              </div>
                              <h4 className="text-left text-base font-bold text-slate-800 sm:text-lg dark:text-white">
                                {t("form.products.premium.name")}
                              </h4>
                              <p className="text-left text-sm text-slate-500 dark:text-slate-400">
                                50U × 30 {t("form.products.days")}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-violet-400 dark:text-slate-600" />
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {t("form.labels.crossChainBridges")}
                        </span>
                      </div>
                      <div className="flex gap-2">

                        <a
                          href="https://www.butterswap.io/zh/swap"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex flex-1 items-center gap-2 rounded-lg border border-orange-200/50 bg-linear-to-br from-orange-50 to-amber-50 p-2.5 transition-all hover:border-orange-400 hover:shadow-md dark:border-orange-500/20 dark:from-orange-500/10 dark:to-amber-500/10"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-500 to-amber-500 overflow-hidden">
                            <Image
                              src="/butter.png"
                              alt="Butterswap"
                              width={28}
                              height={28}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-slate-800 transition-colors group-hover:text-orange-600 dark:text-white dark:group-hover:text-orange-400">
                              Butterswap
                            </h5>
                          </div>
                          <ExternalLink className="h-3 w-3 shrink-0 text-orange-400 opacity-60 transition-opacity group-hover:opacity-100" />
                        </a>

                        <a
                          href="https://meson.fi/zh"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex flex-1 items-center gap-2 rounded-lg border border-purple-200/50 bg-white p-2.5 transition-all hover:border-purple-400 hover:shadow-md dark:border-purple-500/20 dark:bg-slate-800/50 dark:hover:bg-slate-700/50"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white border border-purple-200 dark:bg-slate-700 dark:border-purple-500/20 overflow-hidden">
                            <Image
                              src="/meson.ico"
                              alt="Meson"
                              width={28}
                              height={28}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-slate-800 transition-colors group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">
                              Meson
                            </h5>
                          </div>
                          <ExternalLink className="h-3 w-3 shrink-0 text-purple-400 opacity-60 transition-opacity group-hover:opacity-100" />
                        </a>

                      </div>
                    </div>
                  </div>

                  {/* Right Column - Summary Panel */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-4 rounded-xl border border-slate-300/50 bg-linear-to-b from-slate-100/90 to-slate-200/90 p-5 sm:p-6 dark:border-slate-700/50 dark:from-slate-800/90 dark:to-slate-900/90">
                      <div className="mb-6 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                        <h3 className="font-bold text-slate-800 dark:text-white">
                          {t("form.summary.title")}
                        </h3>
                      </div>

                      {/* Total Amount Display */}
                      <div className="mb-4 rounded-xl bg-white/80 p-4 dark:bg-slate-900/80">
                        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                          {t("form.summary.totalAmount")}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="bg-linear-to-r from-emerald-500 to-green-500 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl dark:from-emerald-400 dark:to-green-400">
                            {calculateTotal()}
                          </span>
                          <span className="font-semibold text-emerald-500 dark:text-emerald-400">
                            {uBasedTokenSymbol}
                          </span>
                        </div>
                      </div>

                      {/* Fee Breakdown */}
                      <div className="mb-6 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            {t("form.summary.baseFee")} ({calculateFee().hasDiscount ? (
                              <><span className="line-through">{calculateFee().originalFeeRate}</span> {calculateFee().feeRate}</>
                            ) : calculateFee().feeRate})
                            {calculateFee().hasDiscount && (
                              <span className="inline-flex items-center rounded bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                                <Crown className="mr-0.5 h-3 w-3" />
                                -50%
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-slate-800 dark:text-white">
                            {calculateFee().hasDiscount && (
                              <span className="mr-2 text-slate-400 line-through">
                                {calculateFee().originalFee}
                              </span>
                            )}
                            {calculateFee().baseFee}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">
                            {t("form.summary.disbursementFee")}
                          </span>
                          <span className="font-mono text-slate-800 dark:text-white">
                            {calculateFee().disbursementFee}
                          </span>
                        </div>
                        <div className="h-px bg-slate-300 dark:bg-slate-700" />
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-600 dark:text-slate-300">
                            {t("form.summary.totalFee")}
                          </span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            {calculateFee().total}
                          </span>
                        </div>
                      </div>

                      {/* Discount Notice / One-click VIP */}
                      {hasVIPDiscount ? (
                        <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-100 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              {t("positions.vip.discountApplied")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-6 space-y-2">
                          <button
                            type="button"
                            onClick={handleOneClickVIP}
                            disabled={!mounted || isVIPLockupProcessing || !isConnected}
                            className="w-full rounded-lg border border-amber-400 bg-gradient-to-r from-amber-100 to-orange-100 p-3 text-left transition-all hover:border-amber-500 hover:from-amber-200 hover:to-orange-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-orange-500/10 dark:hover:from-amber-500/20 dark:hover:to-orange-500/20"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Crown className="h-4 w-4 text-amber-500" />
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                  {t("form.vip.oneClickTitle")}
                                </span>
                              </div>
                              {isVIPLockupProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-300/80">
                              {t("form.vip.oneClickDesc")}
                            </p>
                          </button>
                          <a
                            href="https://web3.okx.com/zh-hans/token/x-layer/0x140aba9691353ed54479372c4e9580d558d954b1"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-xs text-green-500 hover:text-green-600 hover:underline"
                          >
                            {t("form.summary.buyXWaifuLink")} ↗
                          </a>
                        </div>
                      )}

                      {/* Remittance toggle - pill style */}
                      <div className="mb-4 space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("form.remittance.depositOption")}
                        </p>
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white/70 p-1 dark:border-slate-700 dark:bg-slate-800/70">
                          <button
                            type="button"
                            className={`min-w-[88px] rounded-md px-3 py-2 text-sm font-medium transition-all ${
                              !depositRemittance
                                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                            }`}
                            onClick={() => setDepositRemittance(false)}
                          >
                            {t("form.remittance.selfOnly")}
                          </button>
                          <button
                            type="button"
                            className={`min-w-[120px] rounded-md px-3 py-2 text-sm font-medium transition-all ${
                              depositRemittance
                                ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                            }`}
                            onClick={() => setDepositRemittance(true)}
                          >
                            {t("form.remittance.enableRemittance")}
                          </button>
                        </div>
                      </div>

                      {/* Create Button */}
                      {!mounted ? (
                        <Button
                          disabled
                          className="h-14 w-full cursor-not-allowed rounded-xl bg-gray-400 text-lg font-bold text-white shadow-lg transition-all"
                        >
                          Loading...
                        </Button>
                      ) : isWrongChainForSelected ? (
                        <Button
                          onClick={handleSwitchChain}
                          disabled={isSwitchingChain}
                          className="h-14 w-full rounded-xl bg-amber-500 text-lg font-bold text-white shadow-lg transition-all hover:bg-amber-600"
                        >
                          {isSwitchingChain ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          ) : null}
                          Switch to{" "}
                          {chains.find((c) => c.id === selectedChain)?.name ||
                            "Network"}
                        </Button>
                      ) : !isConnected ? (
                        <Button
                          disabled
                          className="h-14 w-full cursor-not-allowed rounded-xl bg-gray-400 text-lg font-bold text-white shadow-lg transition-all"
                        >
                          Connect Wallet First
                        </Button>
                      ) : hasInsufficientUBasedBalance ? (
                        <Button
                          disabled
                          className="h-14 w-full cursor-not-allowed rounded-xl bg-red-500/80 text-lg font-bold text-white shadow-lg transition-all"
                        >
                          {t("form.balance.insufficient")}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleCreateDeposit}
                          disabled={!!disbursementError || isSubmitting}
                          className={`h-14 w-full rounded-xl text-lg font-bold shadow-lg transition-all ${
                            disbursementError || isSubmitting
                              ? "cursor-not-allowed bg-gray-400 text-white"
                              : "bg-linear-to-r from-emerald-500 to-green-500 text-white shadow-emerald-500/25 hover:scale-[1.02] hover:from-emerald-600 hover:to-green-600"
                          }`}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            t("form.buttons.deposit")
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Coin-Based Content */}
            <TabsContent value="coin-based" className="mt-6" forceMount>
              <motion.div
                key="coin-based"
                initial={{ opacity: 0, x: 20 }}
                animate={{
                  opacity: depositType === "coin-based" ? 1 : 0,
                  x: depositType === "coin-based" ? 0 : 20,
                }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className={depositType !== "coin-based" ? "hidden" : ""}
              >
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Left Column */}
                  <div className="space-y-6 lg:col-span-2">
                    {/* Asset Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                          {t("form.coinBased.assetSelection")}
                        </span>
                      </div>

                      <Button
                        onClick={() => setAssetSelectorOpen(true)}
                        variant="outline"
                        className="h-14 w-full justify-between rounded-xl border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800/50 dark:text-white dark:hover:bg-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <CurrencyIcon
                            symbol={selectedCurrency}
                            className="h-8 w-8"
                            iconUrl={selectedCurrencyData?.iconUrl}
                            contractAddress={
                              selectedCurrencyData?.contractAddress
                            }
                            chainId={selectedCurrencyData?.chainId}
                            isNative={selectedCurrencyData?.isNative}
                          />
                          <div className="text-left">
                            <div className="font-bold">{selectedCurrency}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {selectedCurrencyData?.name || selectedCurrency}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="mr-1 text-right">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {chains.find((c) => c.id === selectedChain)
                                ?.name || selectedChain}
                            </div>
                          </div>
                          <ChainIcon
                            symbol={selectedChainSymbol}
                            className="h-5 w-5"
                          />
                          <ChevronsUpDown className="h-4 w-4 text-slate-400" />
                        </div>
                      </Button>
                    </div>

                    {/* Lock Period Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-violet-400" />
                        <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                          {t("form.coinBased.selectDuration")}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { value: "30", label: "30", desc: t("form.days") },
                          { value: "90", label: "90", desc: t("form.days") },
                          { value: "180", label: "180", desc: t("form.days") },
                        ].map((p) => (
                          <button
                            key={p.value}
                            onClick={() => setLockPeriod(p.value)}
                            className={`rounded-xl border p-3 text-center transition-all sm:p-4 ${
                              lockPeriod === p.value
                                ? "border-amber-500 bg-amber-500/20 text-amber-700 dark:text-white"
                                : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400 dark:hover:bg-slate-700/50"
                            }`}
                          >
                            <div className="text-lg font-bold">{p.label}</div>
                            <div className="text-xs opacity-60">{p.desc}</div>
                          </button>
                        ))}
                        <Popover
                          open={customLockPeriodOpen}
                          onOpenChange={setCustomLockPeriodOpen}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className={`rounded-xl border p-3 text-center transition-all sm:p-4 ${
                                !["30", "90", "180"].includes(lockPeriod)
                                  ? "border-amber-500 bg-amber-500/20 text-amber-700 dark:text-white"
                                  : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400 dark:hover:bg-slate-700/50"
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1 text-sm font-bold">
                                <Settings className="h-3 w-3" />
                                {t("form.periods.custom")}
                              </div>
                              <div className="text-xs opacity-60">
                                {!["30", "90", "180"].includes(lockPeriod)
                                  ? `${lockPeriod} ${t("form.days")}`
                                  : t("form.periods.customDesc")}
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-slate-800 dark:text-white">
                                {t("form.periods.customTitle")}
                              </h4>
                              <Input
                                type="number"
                                placeholder={t(
                                  "form.periods.customPlaceholder"
                                )}
                                value={customLockPeriodValue}
                                onChange={(e) =>
                                  setCustomLockPeriodValue(e.target.value)
                                }
                                className="border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                              />
                              <Button
                                onClick={() => {
                                  if (
                                    customLockPeriodValue &&
                                    Number.parseInt(customLockPeriodValue) > 0
                                  ) {
                                    setLockPeriod(customLockPeriodValue);
                                    setCustomLockPeriodOpen(false);
                                  }
                                }}
                                className="w-full bg-amber-500 text-white hover:bg-amber-600"
                              >
                                {t("form.periods.customConfirm")}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Amount Input - Coin Based */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                        <Vault className="h-4 w-4 text-amber-400" />
                        {t("form.coinBased.lockAmount")}
                      </label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-14 rounded-xl border-slate-300 bg-slate-100 text-base font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                      />
                      <div className="grid grid-cols-5 gap-2">
                        {quickAmounts.map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setAmount(amt)}
                            className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-amber-400 hover:bg-amber-100 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400 dark:hover:border-amber-500 dark:hover:bg-amber-500/20 dark:hover:text-amber-400"
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cross-chain Bridge section*/}
                    <div className="mb-6 space-y-2">
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {t("form.labels.crossChainBridges")}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href="https://jumper.exchange/zh"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex flex-1 items-center gap-2 rounded-lg border border-purple-200/50 bg-linear-to-br from-purple-50 to-indigo-50 p-2.5 transition-all hover:border-purple-400 hover:shadow-md dark:border-purple-500/20 dark:from-purple-500/10 dark:to-indigo-500/10"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-indigo-600 overflow-hidden">
                            <Image
                              src="/jumper.ico"
                              alt="Jumper"
                              width={28}
                              height={28}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-slate-800 transition-colors group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">
                              Jumper
                            </h5>
                          </div>
                          <ExternalLink className="h-3 w-3 shrink-0 text-purple-400 opacity-60 transition-opacity group-hover:opacity-100" />
                        </a>

                        {/* Orbiter Bridge */}
                        <a
                          href="https://www.butterswap.io/zh/swap"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex flex-1 items-center gap-2 rounded-lg border border-orange-200/50 bg-linear-to-br from-orange-50 to-amber-50 p-2.5 transition-all hover:border-orange-400 hover:shadow-md dark:border-orange-500/20 dark:from-orange-500/10 dark:to-amber-500/10"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-500 to-amber-500 overflow-hidden">
                            <Image
                              src="/butter.png"
                              alt="Butterswap"
                              width={28}
                              height={28}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-slate-800 transition-colors group-hover:text-orange-600 dark:text-white dark:group-hover:text-orange-400">
                              Butterswap
                            </h5>
                          </div>
                          <ExternalLink className="h-3 w-3 shrink-0 text-orange-400 opacity-60 transition-opacity group-hover:opacity-100" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Summary */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-4 rounded-xl border border-slate-300/50 bg-linear-to-b from-slate-100/90 to-slate-200/90 p-5 sm:p-6 dark:border-slate-700/50 dark:from-slate-800/90 dark:to-slate-900/90">
                      <div className="mb-6 flex items-center gap-2">
                        <Lock className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                        <h3 className="font-bold text-slate-800 dark:text-white">
                          {t("form.coinBased.title")}
                        </h3>
                      </div>

                      {/* Lock Amount Display */}
                      <div className="mb-4 rounded-xl bg-white/80 p-4 dark:bg-slate-900/80">
                        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                          {t("form.summary.lockAmount")}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="bg-linear-to-r from-amber-500 to-orange-500 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl dark:from-amber-400 dark:to-orange-400">
                            {amount || "0"}
                          </span>
                          <span className="font-semibold text-amber-500 dark:text-amber-400">
                            {selectedCurrency}
                          </span>
                        </div>
                      </div>

                      {/* Lock Period Display */}
                      <div className="mb-6 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">
                            {t("form.summary.lockPeriod")}
                          </span>
                          <span className="font-mono text-slate-800 dark:text-white">
                            {lockPeriod} {t("form.summary.days")}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">
                            {t("form.labels.unlockDate")}
                          </span>
                          <span className="font-mono text-slate-800 dark:text-white">
                            {new Date(unlockDate).toISOString().split("T")[0]}
                          </span>
                        </div>
                      </div>
                      <div className="h-px bg-slate-300 dark:bg-slate-700" />
                      <div className="my-3 flex justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                          {t("form.summary.fee")}
                          {hasVIPDiscount && (
                            <span className="inline-flex items-center rounded bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                              <Crown className="mr-0.5 h-3 w-3" />
                              -50%
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          {hasVIPDiscount && (
                            <span className="mr-2 text-slate-400 line-through">
                              0.5%
                            </span>
                          )}
                          {hasVIPDiscount ? "0.25%" : "0.5%"}
                        </span>
                      </div>

                      {/* VIP Discount Notice / One-click VIP */}
                      {hasVIPDiscount ? (
                        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-100 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              {t("positions.vip.discountApplied")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4 space-y-2">
                          <button
                            type="button"
                            onClick={handleOneClickVIP}
                            disabled={!mounted || isVIPLockupProcessing || !isConnected}
                            className="w-full rounded-lg border border-amber-400 bg-gradient-to-r from-amber-100 to-orange-100 p-3 text-left transition-all hover:border-amber-500 hover:from-amber-200 hover:to-orange-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-orange-500/10 dark:hover:from-amber-500/20 dark:hover:to-orange-500/20"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Crown className="h-4 w-4 text-amber-500" />
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                  {t("form.vip.oneClickTitle")}
                                </span>
                              </div>
                              {isVIPLockupProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-300/80">
                              {t("form.vip.oneClickDesc")}
                            </p>
                          </button>
                          <a
                            href="https://web3.okx.com/zh-hans/token/x-layer/0x140aba9691353ed54479372c4e9580d558d954b1"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-xs text-green-500 hover:text-green-600 hover:underline"
                          >
                            {t("form.summary.buyXWaifuLink")} ↗
                          </a>
                        </div>
                      )}

                      {/* Security Notice */}
                      <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                        <div className="mb-1 flex items-center gap-2">
                          <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            {t("form.coinBased.securedBy")}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-600 dark:text-emerald-300/80">
                          {t("form.coinBased.info")}
                        </p>
                      </div>

                      {/* Balance display for coin-based */}
                      {isConnected && actualLockupBalance !== undefined && (
                        <div className="mb-4 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Wallet className="h-3 w-3" />
                            {t("form.balance.label")}
                          </span>
                          <span
                            className={`font-mono ${hasInsufficientLockupBalance ? "text-red-500" : "text-slate-600 dark:text-slate-300"}`}
                          >
                            {typeof actualLockupBalance === "bigint"
                              ? Number(
                                  formatUnits(
                                    actualLockupBalance,
                                    lockupTokenDecimals
                                  )
                                ).toLocaleString(undefined, {
                                  maximumFractionDigits: 6,
                                })
                              : "0"}{" "}
                            {selectedCurrency}
                          </span>
                        </div>
                      )}

                      {/* Remittance toggle for coin-based - pill style */}
                      <div className="mb-4 space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("form.remittance.lockupOption")}
                        </p>
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white/70 p-1 dark:border-slate-700 dark:bg-slate-800/70">
                          <button
                            type="button"
                            className={`min-w-[88px] rounded-md px-3 py-2 text-sm font-medium transition-all ${
                              !lockupRemittance
                                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                            }`}
                            onClick={() => setLockupRemittance(false)}
                          >
                            {t("form.remittance.selfOnly")}
                          </button>
                          <button
                            type="button"
                            className={`min-w-[120px] rounded-md px-3 py-2 text-sm font-medium transition-all ${
                              lockupRemittance
                                ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                            }`}
                            onClick={() => setLockupRemittance(true)}
                          >
                            {t("form.remittance.enableRemittance")}
                          </button>
                        </div>
                      </div>

                      {/* Lock Button */}
                      {!mounted ? (
                        <Button
                          disabled
                          className="h-14 w-full cursor-not-allowed rounded-xl bg-gray-400 text-lg font-bold text-white shadow-lg transition-all"
                        >
                          Loading...
                        </Button>
                      ) : isWrongChainForSelected ? (
                        <Button
                          onClick={handleSwitchChain}
                          disabled={isSwitchingChain}
                          className="h-14 w-full rounded-xl bg-amber-500 text-lg font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] hover:bg-amber-600"
                        >
                          {isSwitchingChain ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          ) : null}
                          Switch to{" "}
                          {chains.find((c) => c.id === selectedChain)?.name ||
                            "Network"}
                        </Button>
                      ) : !isConnected ? (
                        <Button
                          disabled
                          className="h-14 w-full cursor-not-allowed rounded-xl bg-gray-400 text-lg font-bold text-white shadow-lg transition-all"
                        >
                          Connect Wallet First
                        </Button>
                      ) : hasInsufficientLockupBalance ? (
                        <Button
                          disabled
                          className="h-14 w-full cursor-not-allowed rounded-xl bg-red-500/80 text-lg font-bold text-white shadow-lg transition-all"
                        >
                          {t("form.balance.insufficient")}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleLockDeposit}
                          disabled={
                            isSubmitting ||
                            !amount ||
                            Number.parseFloat(amount) <= 0
                          }
                          className={`h-14 w-full rounded-xl text-lg font-bold shadow-lg transition-all ${
                            isSubmitting ||
                            !amount ||
                            Number.parseFloat(amount) <= 0
                              ? "cursor-not-allowed bg-gray-400 text-white"
                              : "bg-linear-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/25 hover:scale-[1.02] hover:from-amber-600 hover:to-orange-600"
                          }`}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            t("form.buttons.lockDeposit")
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
