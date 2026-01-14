"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";
import { Inbox } from "lucide-react";
import {
  TrendingUp,
  Calendar,
  Repeat,
  Coins,
  FolderOpen,
  RefreshCw,
  Loader2,
  Clock,
  Lock,
  Unlock,
  Crown,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAccount, useSwitchChain } from "wagmi";
import type { Position } from "@/app/page";
import {
  useWithdraw,
  useWithdrawLockup,
  useBlockchainTime,
  useEnableDepositRemittance,
  useEnableLockupRemittance,
  useTokenAllowance,
  useTokenBalance,
  useRemittanceFee,
  useApproveToken,
  useWarehouseAddress,
  useEmergencyCancel,
  useEmergencyCancelLockup,
  useActivateVIP,
  useXwaifuToken,
  canActivateVIP,
} from "@/lib/contracts";
import {
  getTokenAddress,
  getWarehouseAddress,
  type SupportedChainId,
} from "@/lib/chains";
import { useChainId } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { config as wagmiConfig } from "@/lib/web3";
import { formatUnits } from "viem";
import { warehouseAbi, erc20Abi } from "@/lib/abi";
import { writeContract } from "@wagmi/core";
import { zeroAddress } from "viem";

// Helper to format token amount based on token type
// USDC/USDT: 2 decimal places, others: 6 decimals for small amounts, M/K for large
function formatTokenAmount(
  amount: string,
  currency: string,
  decimals = 18
): string {
  try {
    const formatted = formatUnits(BigInt(amount), decimals);
    const num = Number.parseFloat(formatted);

    // Check if it's a stablecoin (USDC/USDT)
    const isStablecoin =
      currency.toUpperCase() === "USDC" || currency.toUpperCase() === "USDT";

    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + "M";
    } else if (isStablecoin) {
      // Stablecoins: always 2 decimal places
      return num.toFixed(2);
    } else if (num >= 1) {
      // Other tokens with decent amounts: 4 decimal places
      return num.toFixed(4);
    } else {
      // Small amounts: 6 decimal places
      return num.toFixed(6);
    }
  } catch {
    return amount;
  }
}

// Helper to format countdown (使用区块链时间)
function formatCountdown(
  targetTimestamp: number,
  blockchainNow: number,
  t: (key: string) => string
): string {
  const diff = targetTimestamp - blockchainNow;

  if (diff <= 0) return t("positions.countdown.canWithdraw");

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) {
    return `${days}${t("positions.countdown.days")} ${hours}${t("positions.countdown.hours")}`;
  } else if (hours > 0) {
    return `${hours}${t("positions.countdown.hours")} ${minutes}${t("positions.countdown.minutes")}`;
  } else {
    return `${minutes}${t("positions.countdown.minutes")}`;
  }
}

// Countdown component - uses initial blockchain time offset for display
// The actual canWithdraw is computed server-side with blockchain time
function Countdown({
  targetTimestamp,
  initialBlockchainTime,
  t,
}: {
  targetTimestamp: number;
  initialBlockchainTime: number | undefined;
  t: (key: string) => string;
}) {
  const [displayTime, setDisplayTime] = useState<string>("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (initialBlockchainTime === undefined) return;

    // Calculate offset between blockchain time and local time
    const localNow = Math.floor(Date.now() / 1000);
    const offset = initialBlockchainTime - localNow;

    const updateDisplay = () => {
      // Use local time + offset to estimate current blockchain time
      const estimatedBlockchainTime = Math.floor(Date.now() / 1000) + offset;
      const ready = targetTimestamp <= estimatedBlockchainTime;
      setIsReady(ready);
      setDisplayTime(
        formatCountdown(targetTimestamp, estimatedBlockchainTime, t)
      );
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp, initialBlockchainTime, t]);

  // If blockchain time is not loaded, show loading
  if (initialBlockchainTime === undefined) {
    return (
      <span className="text-muted-foreground flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("positions.countdown.loading")}
      </span>
    );
  }

  return (
    <span
      className={isReady ? "font-semibold text-emerald-500" : "text-amber-500"}
    >
      {isReady ? (
        <span className="flex items-center gap-1">
          <Unlock className="h-3 w-3" />
          {displayTime}
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          {displayTime}
        </span>
      )}
    </span>
  );
}

interface PositionsListProps {
  positions: Position[];
  isLoading?: boolean;
  onRemovePosition: (id: string) => void;
  onRefresh?: () => void;
}

export function PositionsList({
  positions,
  isLoading,
  onRemovePosition,
  onRefresh,
}: PositionsListProps) {
  const { t } = useI18n();
  const { isConnected, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const warehouseAddress = useWarehouseAddress();
  const usdtAddress = getTokenAddress(chainId, "USDT");
  const {
    withdraw,
    isPending: isWithdrawing,
    isSuccess: isWithdrawSuccess,
  } = useWithdraw();
  const {
    withdrawLockup,
    isPending: isWithdrawingLockup,
    isSuccess: isWithdrawLockupSuccess,
  } = useWithdrawLockup();

  const { enableDepositRemittance, isPending: isEnablingDeposit } =
    useEnableDepositRemittance();

  const { enableLockupRemittance, isPending: isEnablingLockup } =
    useEnableLockupRemittance();

  const { data: remittanceFee } = useRemittanceFee();
  const { data: usdtAllowance, refetch: refetchUsdtAllowance } =
    useTokenAllowance(usdtAddress, address, warehouseAddress);
  const { data: usdtBalance } = useTokenBalance(usdtAddress, address);
  const { approve: approveUsdt, isPending: isApprovingRemitFee } =
    useApproveToken();

  const { emergencyCancel, isPending: isEmergencyDeposit } =
    useEmergencyCancel();
  const { emergencyCancelLockup, isPending: isEmergencyLockup } =
    useEmergencyCancelLockup();

  // VIP activation
  const { activateVIP, isPending: isActivatingVIP } = useActivateVIP();
  const { data: xwaifuTokenAddress } = useXwaifuToken();
  const [activatingVIPId, setActivatingVIPId] = useState<string | null>(null);

  const [recipientMap, setRecipientMap] = useState<Record<string, string>>({});
  const [enablingId, setEnablingId] = useState<string | null>(null);
  const [earlyClickMap, setEarlyClickMap] = useState<Record<string, number>>(
    {}
  );
  const [isEarlyProcessing, setIsEarlyProcessing] = useState(false);
  const [isWithdrawingAction, setIsWithdrawingAction] = useState(false);
  const [isEnablingAction, setIsEnablingAction] = useState(false);
  const [positionFilter, setPositionFilter] = useState<"current" | "history">(
    "current"
  );

  // 汇付弹窗状态
  const [remitDialogOpen, setRemitDialogOpen] = useState(false);
  const [remitPosition, setRemitPosition] = useState<Position | null>(null);
  const [remitAddress, setRemitAddress] = useState("");
  const [isRemitting, setIsRemitting] = useState(false);

  // 提前取出弹窗状态
  const [earlyWithdrawDialogOpen, setEarlyWithdrawDialogOpen] = useState(false);
  const [earlyWithdrawPosition, setEarlyWithdrawPosition] = useState<Position | null>(null);
  const [earlyWithdrawToOther, setEarlyWithdrawToOther] = useState(false);
  const [earlyWithdrawAddress, setEarlyWithdrawAddress] = useState("");

  // 获取区块链时间（严格从链上读取）
  const { timestamp: blockchainTime } = useBlockchainTime();

  // Fix hydration mismatch - only use wallet state after client mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto refresh once after a successful tx (avoid multiple triggers)
  useEffect(() => {
    if (isWithdrawSuccess || isWithdrawLockupSuccess) {
      setTimeout(() => onRefresh?.(), 800);
    }
  }, [isWithdrawSuccess, isWithdrawLockupSuccess, onRefresh]);

  const handleWithdraw = async (position: Position) => {
    try {
      if (position.chainId && position.chainId !== chainId) {
        const switched = await switchChainAsync?.({
          chainId: position.chainId,
        });
        if (!switched || switched.id !== position.chainId) {
          throw new Error(t("positions.errors.chainSwitchFailed"));
        }
      }

      const targetWarehouse = getWarehouseAddress(
        position.chainId as SupportedChainId
      );
      if (!targetWarehouse) {
        throw new Error(t("positions.errors.warehouseNotConfigured"));
      }

      // Parse ID: format is "deposit-{chainId}-{index}" or "lockup-{chainId}-{index}"
      const parts = position.id.split("-");
      const type = parts[0]; // "deposit" or "lockup"
      const index = BigInt(parts[2]); // The actual contract index

      const recipient = (recipientMap[position.id] || "").trim();
      const toAddress =
        recipient.startsWith("0x") && recipient.length === 42
          ? (recipient as `0x${string}`)
          : zeroAddress;

      setIsWithdrawingAction(true);

      const functionName = type === "deposit" ? "withdraw" : "withdrawLockup";
      const txHash = await writeContract(wagmiConfig, {
        address: targetWarehouse,
        abi: warehouseAbi,
        functionName,
        args: [index, toAddress],
        chainId: position.chainId,
      });

      await waitForTransactionReceipt(wagmiConfig, { hash: txHash });

      toast.success(t("toast.withdrawSuccess.title"), {
        description: "Withdrawal submitted. Please confirm in your wallet.",
      });

      // Refresh positions after a delay
      setTimeout(() => onRefresh?.(), 2000);
    } catch (err) {
      toast.error("Withdraw failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsWithdrawingAction(false);
    }
  };

  const handleEarlyRemitWithdraw = async (position: Position, toAddress?: string) => {
    setIsEarlyProcessing(true);
    try {
      if (position.chainId && position.chainId !== chainId) {
        const switched = await switchChainAsync?.({
          chainId: position.chainId,
        });
        if (!switched || switched.id !== position.chainId) {
          throw new Error(t("positions.errors.chainSwitchFailed"));
        }
      }

      const targetWarehouse = getWarehouseAddress(
        position.chainId as SupportedChainId
      );
      if (!targetWarehouse) {
        throw new Error(t("positions.errors.warehouseNotConfigured"));
      }

      if (!position.createdAsRemit) {
        throw new Error(t("positions.errors.onlyNativeRemittance"));
      }

      const recipient = toAddress?.trim() || "";
      const finalAddress =
        recipient.startsWith("0x") && recipient.length === 42
          ? (recipient as `0x${string}`)
          : zeroAddress;

      const parts = position.id.split("-");
      const type = parts[0];
      const index = BigInt(parts[2]);

      const functionName =
        type === "deposit" ? "emergencyCancel" : "emergencyCancelLockup";
      const txHash = await writeContract(wagmiConfig, {
        address: targetWarehouse,
        abi: warehouseAbi,
        functionName,
        args: [index, finalAddress],
        chainId: position.chainId,
      });

      if (txHash) {
        await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      }

      toast.success(t("positions.toast.earlyWithdrawSubmitted.title"), {
        description: t("positions.toast.earlyWithdrawSubmitted.description"),
      });
      setTimeout(() => onRefresh?.(), 1500);
    } catch (err) {
      toast.error(t("positions.toast.earlyWithdrawFailed.title"), {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsEarlyProcessing(false);
    }
  };

  // 提前取出弹窗确认
  const handleEarlyWithdrawConfirm = async () => {
    if (!earlyWithdrawPosition) return;

    if (earlyWithdrawToOther) {
      const addr = earlyWithdrawAddress.trim();
      if (!addr.startsWith("0x") || addr.length !== 42) {
        toast.error(t("positions.earlyWithdraw.invalidAddress"));
        return;
      }
      await handleEarlyRemitWithdraw(earlyWithdrawPosition, addr);
    } else {
      await handleEarlyRemitWithdraw(earlyWithdrawPosition);
    }

    setEarlyWithdrawDialogOpen(false);
    setEarlyWithdrawPosition(null);
    setEarlyWithdrawToOther(false);
    setEarlyWithdrawAddress("");
  };

  // Handle VIP activation for xwaifu lockups on X Layer
  const handleActivateVIP = async (position: Position) => {
    setActivatingVIPId(position.id);
    try {
      if (position.chainId && position.chainId !== chainId) {
        const switched = await switchChainAsync?.({
          chainId: position.chainId,
        });
        if (!switched || switched.id !== position.chainId) {
          throw new Error(t("positions.errors.chainSwitchFailed"));
        }
      }

      // Parse lockup ID from position.id: "lockup-{chainId}-{index}"
      const parts = position.id.split("-");
      const index = BigInt(parts[2]);

      toast.info(t("positions.vip.activating"), {
        description: t("positions.vip.activatingDesc"),
      });

      const txHash = await activateVIP(index);
      if (txHash) {
        await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      }

      toast.success(t("positions.vip.activated"), {
        description: t("positions.vip.activatedDesc"),
      });

      setTimeout(() => onRefresh?.(), 1500);
    } catch (err) {
      const msg =
        (err as { shortMessage?: string })?.shortMessage ||
        (err as Error)?.message ||
        "Please try again";
      toast.error(t("positions.vip.activateFailed"), {
        description: msg,
      });
    } finally {
      setActivatingVIPId(null);
    }
  };

  const handleEnableRemittance = async (position: Position) => {
    setEnablingId(position.id);
    setIsEnablingAction(true);
    try {
      if (!address) throw new Error(t("positions.errors.connectWallet"));
      const targetWarehouse = getWarehouseAddress(
        position.chainId as SupportedChainId
      );
      const targetUsdt = getTokenAddress(
        position.chainId as SupportedChainId,
        "USDT"
      );
      if (!targetWarehouse)
        throw new Error(t("positions.errors.warehouseNotConfigured"));
      if (!targetUsdt) throw new Error(t("positions.errors.usdtNotConfigured"));

      if (position.chainId && position.chainId !== chainId) {
        const switched = await switchChainAsync?.({
          chainId: position.chainId,
        });
        if (!switched || switched.id !== position.chainId) {
          throw new Error(t("positions.errors.chainSwitchFailed"));
        }
      }

      const fee = (remittanceFee as bigint | undefined) ?? 0n;
      if (fee === 0n) throw new Error(t("positions.errors.cannotGetFee"));

      const parts = position.id.split("-");
      const type = parts[0];
      const index = BigInt(parts[2]);

      // Approve fee
      toast.info(t("positions.toast.approveRemittanceFee.title"), {
        description: t("positions.toast.approveRemittanceFee.description"),
      });
      const approveHash = await writeContract(wagmiConfig, {
        address: targetUsdt,
        abi: erc20Abi,
        functionName: "approve",
        args: [targetWarehouse, fee],
        chainId: position.chainId,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

      const functionName =
        type === "deposit"
          ? "enableDepositRemittance"
          : "enableLockupRemittance";
      const txHash = await writeContract(wagmiConfig, {
        address: targetWarehouse,
        abi: warehouseAbi,
        functionName,
        args: [index],
        chainId: position.chainId,
      });

      if (txHash) {
        await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      }

      toast.success(t("positions.toast.enableRemittanceSubmitted.title"), {
        description: t("positions.toast.enableRemittanceSubmitted.description"),
      });

      setTimeout(() => onRefresh?.(), 2000);
    } catch (err) {
      const msg =
        (err as any)?.shortMessage ||
        (err as Error)?.message ||
        "Please try again";
      toast.error(t("positions.toast.enableRemittanceFailed.title"), {
        description: msg,
      });
    } finally {
      setEnablingId(null);
      setIsEnablingAction(false);
    }
  };

  // 汇付到指定地址
  const handleRemit = async () => {
    if (!remitPosition) return;

    const addr = remitAddress.trim();
    if (!addr.startsWith("0x") || addr.length !== 42) {
      toast.error(t("positions.remittance.invalidAddress"));
      return;
    }

    setIsRemitting(true);
    try {
      if (remitPosition.chainId && remitPosition.chainId !== chainId) {
        const switched = await switchChainAsync?.({
          chainId: remitPosition.chainId,
        });
        if (!switched || switched.id !== remitPosition.chainId) {
          throw new Error(t("positions.errors.chainSwitchFailed"));
        }
      }

      const targetWarehouse = getWarehouseAddress(
        remitPosition.chainId as SupportedChainId
      );
      if (!targetWarehouse) {
        throw new Error(t("positions.errors.warehouseNotConfigured"));
      }

      const parts = remitPosition.id.split("-");
      const type = parts[0];
      const index = BigInt(parts[2]);

      const functionName = type === "deposit" ? "withdraw" : "withdrawLockup";
      const txHash = await writeContract(wagmiConfig, {
        address: targetWarehouse,
        abi: warehouseAbi,
        functionName,
        args: [index, addr as `0x${string}`],
        chainId: remitPosition.chainId,
      });

      await waitForTransactionReceipt(wagmiConfig, { hash: txHash });

      toast.success(t("toast.withdrawSuccess.title"));
      setRemitDialogOpen(false);
      setRemitAddress("");
      setRemitPosition(null);
      setTimeout(() => onRefresh?.(), 2000);
    } catch (err) {
      toast.error("Remit failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsRemitting(false);
    }
  };

  // Filter positions based on current/history selection
  const filteredPositions = positions.filter((p) =>
    positionFilter === "current"
      ? p.status === "active"
      : p.status === "completed"
  );

  const showInitialLoading = isLoading && positions.length === 0;
  const showEmpty = filteredPositions.length === 0 && !showInitialLoading;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/50 bg-white/50 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/50">
      <div className="flex items-center justify-between border-b border-slate-200/50 bg-white/50 px-4 py-4 sm:px-6 dark:border-slate-700/50 dark:bg-slate-800/50">
        <div className="hidden items-center gap-3 sm:flex">
          <FolderOpen className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
            my-positions
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {t("positions.title")}
            </h2>
          </div>
          {/* Current/History Filter Selector */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-1 dark:bg-slate-700/80">
            <button
              type="button"
              onClick={() => setPositionFilter("current")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                positionFilter === "current"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t("positions.filter.current")}
            </button>
            <button
              type="button"
              onClick={() => setPositionFilter("history")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                positionFilter === "history"
                  ? "bg-slate-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t("positions.filter.history")}
            </button>
          </div>
          {isLoading && positions.length > 0 && (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          )}
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading && positions.length === 0}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="space-y-4 p-4 sm:p-6">
        {/* Loading State */}
        {isLoading && positions.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredPositions.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-12 dark:border-slate-700">
            <Inbox className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {positionFilter === "current"
                ? t("positions.empty.current")
                : t("positions.empty.history")}
            </p>
          </div>
        )}

        {/* Positions Grid */}
        {filteredPositions.length > 0 && (
          <div className="grid gap-4">
            {filteredPositions.map((position) => {
              // Determine if withdraw button should be enabled
              const isProcessing =
                isWithdrawing ||
                isWithdrawingLockup ||
                isEmergencyDeposit ||
                isEmergencyLockup ||
                isWithdrawingAction;
              const isEnabling =
                isEnablingDeposit ||
                isEnablingLockup ||
                isApprovingRemitFee ||
                enablingId === position.id ||
                isEnablingAction;
              const canWithdrawNow = position.canWithdraw ?? false;
              const isWithdrawDisabled =
                !canWithdrawNow ||
                position.status !== "active" ||
                isProcessing ||
                isEarlyProcessing;

              // Get the next withdraw time for countdown
              const nextWithdrawTime =
                position.type === "u-based"
                  ? position.nextWithdrawTime
                  : position.unlockTime;

              // Display amount: for u-based show total, for coin-based show amount
              const displayAmount =
                position.type === "u-based"
                  ? position.totalAmount || position.amount
                  : position.amount;

              // VIP 相关判断（检查合约 xwaifuToken 是否有效，即非零地址）
              const xwaifuAddr = xwaifuTokenAddress
                ? String(xwaifuTokenAddress).toLowerCase()
                : "";
              const hasXwaifuSupport =
                xwaifuAddr &&
                xwaifuAddr !== "0x0000000000000000000000000000000000000000";
              const positionTokenAddr =
                position.tokenAddress?.toLowerCase() || "";

              const isXwaifuLockup =
                position.type === "coin-based" &&
                hasXwaifuSupport &&
                positionTokenAddr === xwaifuAddr;

              // 检查是否可以激活 VIP
              const canActivateResult = canActivateVIP(
                BigInt(position.amount),
                position.unlockTime!,
                position.createTime!,
                position.isDiscountActive || false,
                false
              );

              const canActivate =
                isXwaifuLockup &&
                !position.isDiscountActive &&
                position.status === "active" &&
                position.createTime !== undefined &&
                position.unlockTime !== undefined &&
                canActivateResult;

              // 是否已经是 VIP
              const isVIP =
                isXwaifuLockup && position.isDiscountActive === true;

              return (
                <div
                  key={position.id}
                  className="rounded-lg border border-slate-200/50 bg-slate-100/80 p-4 transition-colors hover:border-emerald-500/50 sm:p-5 dark:border-slate-700/50 dark:bg-slate-800/50"
                >
                  <div className="flex flex-col gap-4">
                    {/* Top Row - Status Badge and VIP */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-0 bg-linear-to-r from-emerald-500 to-green-500 text-white">
                        {position.type === "u-based"
                          ? t("positions.types.uBased")
                          : t("positions.types.coinBased")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                      >
                        {position.chain}
                      </Badge>
                      <Badge
                        variant={
                          position.status === "active" ? "default" : "secondary"
                        }
                      >
                        {position.status === "active"
                          ? t("positions.status.active")
                          : t("positions.status.completed")}
                      </Badge>
                      {/* VIP 徽章 */}
                      {isVIP && (
                        <Badge className="border-0 bg-linear-to-r from-amber-500 to-orange-500 text-white">
                          <Crown className="mr-1 h-3 w-3" />
                          VIP
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      {/* Total Amount */}
                      <div className="flex min-w-0 items-center gap-2">
                        <Coins className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {position.type === "u-based"
                              ? t("positions.fields.totalAmount")
                              : t("positions.fields.amount")}
                          </p>
                          <p className="truncate font-semibold text-slate-800 dark:text-slate-200">
                            {formatTokenAmount(
                              displayAmount,
                              position.currency,
                              position.decimals
                            )}{" "}
                            {position.currency}
                          </p>
                        </div>
                      </div>

                      {position.type === "u-based" && (
                        <>
                          <div className="flex min-w-0 items-center gap-2">
                            <Coins className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {t("positions.fields.perPeriod")}
                              </p>
                              <p className="truncate font-semibold text-slate-800 dark:text-slate-200">
                                {formatTokenAmount(
                                  position.amount,
                                  position.currency,
                                  position.decimals
                                )}{" "}
                                {position.currency}
                              </p>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <Repeat className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {t("positions.fields.remaining")}
                              </p>
                              <p className="truncate font-semibold text-slate-800 dark:text-slate-200">
                                {position.remaining}/{position.frequency}
                              </p>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Period/Lock time */}
                      <div className="flex min-w-0 items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {position.type === "u-based"
                              ? t("positions.fields.period")
                              : t("positions.fields.lockPeriod")}
                          </p>
                          <p className="truncate font-semibold text-slate-800 dark:text-slate-200">
                            {position.period} {t("positions.fields.days")}
                          </p>
                        </div>
                      </div>

                      {/* Countdown / Next withdraw time */}
                      {position.status === "active" && nextWithdrawTime && (
                        <div className="flex min-w-0 items-center gap-2">
                          <Clock className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {position.type === "u-based"
                                ? t("positions.fields.nextWithdraw")
                                : t("positions.fields.unlockCountdown")}
                            </p>
                            <Countdown
                              targetTimestamp={nextWithdrawTime}
                              initialBlockchainTime={blockchainTime}
                              t={t}
                            />
                          </div>
                        </div>
                      )}

                      {/* Start date */}
                      <div className="flex min-w-0 items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {t("positions.fields.startDate")}
                          </p>
                          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {position.startDate}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - Stack on mobile */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {/* VIP 激活按钮 - 仅对 X Layer 上符合条件的 xwaifu lockup 显示 */}
                      {canActivate && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-amber-500 bg-transparent text-amber-600 hover:bg-amber-50 sm:flex-none dark:border-amber-400 dark:text-amber-200"
                          onClick={() => handleActivateVIP(position)}
                          disabled={
                            isActivatingVIP && activatingVIPId === position.id
                          }
                        >
                          {isActivatingVIP &&
                          activatingVIPId === position.id ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Crown className="mr-1 h-4 w-4" />
                          )}
                          {t("positions.vip.activate")}
                        </Button>
                      )}

                      {!position.remittanceEnabled &&
                        position.status === "active" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 sm:flex-none"
                            onClick={() => handleEnableRemittance(position)}
                            disabled={isEnabling}
                          >
                            {isEnabling ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : null}
                            {t("positions.actions.enableRemittance")}
                          </Button>
                        )}

                      {/* 原生汇付仓位提前取出按钮（蓝色强调） */}
                      {position.status === "active" &&
                        position.createdAsRemit && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-blue-500 bg-transparent text-blue-600 hover:bg-blue-50 sm:flex-none dark:border-blue-400 dark:text-blue-200"
                            onClick={() => {
                              setEarlyWithdrawPosition(position);
                              setEarlyWithdrawToOther(false);
                              setEarlyWithdrawAddress("");
                              setEarlyWithdrawDialogOpen(true);
                            }}
                            disabled={isEarlyProcessing || isProcessing}
                          >
                            {isEarlyProcessing ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : null}
                            {t("positions.actions.earlyWithdraw")}
                          </Button>
                        )}

                      {position.status === "active" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className={`flex-1 sm:flex-none ${isWithdrawDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                          onClick={() => {
                            if (!canWithdrawNow) {
                              return;
                            }
                            handleWithdraw(position);
                          }}
                          disabled={isWithdrawDisabled}
                        >
                          {isProcessing || isEarlyProcessing ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : null}
                          {t("positions.actions.withdraw")}
                        </Button>
                      )}

                      {/* 汇付按钮 - 仅当汇付已开启时显示，未到时间则禁用 */}
                      {position.status === "active" &&
                        position.remittanceEnabled && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={`flex-1 border-purple-500 bg-transparent text-purple-600 hover:bg-purple-50 sm:flex-none dark:border-purple-400 dark:text-purple-200 ${!canWithdrawNow ? "cursor-not-allowed opacity-60" : ""}`}
                            onClick={() => {
                              if (!canWithdrawNow) return;
                              setRemitPosition(position);
                              setRemitAddress("");
                              setRemitDialogOpen(true);
                            }}
                            disabled={!canWithdrawNow || isProcessing || isRemitting}
                          >
                            <Send className="mr-1 h-4 w-4" />
                            {t("positions.actions.remit")}
                          </Button>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 汇付弹窗 */}
      <Dialog open={remitDialogOpen} onOpenChange={setRemitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("positions.remittance.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("positions.remittance.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("positions.remittance.recipientAddress")}
              </label>
              <Input
                placeholder={t("positions.remittance.recipientPlaceholder")}
                value={remitAddress}
                onChange={(e) => setRemitAddress(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleRemit}
              disabled={isRemitting}
            >
              {isRemitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {t("positions.remittance.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 提前取出弹窗 */}
      <Dialog open={earlyWithdrawDialogOpen} onOpenChange={setEarlyWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("positions.earlyWithdraw.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("positions.earlyWithdraw.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 选择提现到自己还是其他地址 */}
            <div className="flex flex-col gap-2">
              <Button
                variant={!earlyWithdrawToOther ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setEarlyWithdrawToOther(false)}
              >
                {t("positions.earlyWithdraw.toSelf")}
              </Button>
              <Button
                variant={earlyWithdrawToOther ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setEarlyWithdrawToOther(true)}
              >
                {t("positions.earlyWithdraw.toOther")}
              </Button>
            </div>

            {/* 如果选择其他地址，显示输入框 */}
            {earlyWithdrawToOther && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("positions.earlyWithdraw.recipientAddress")}
                </label>
                <Input
                  placeholder={t("positions.earlyWithdraw.recipientPlaceholder")}
                  value={earlyWithdrawAddress}
                  onChange={(e) => setEarlyWithdrawAddress(e.target.value)}
                />
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleEarlyWithdrawConfirm}
              disabled={isEarlyProcessing}
            >
              {isEarlyProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("positions.earlyWithdraw.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
