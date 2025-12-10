"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
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
} from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import type { Position } from "@/app/page";
import { useWithdraw, useWithdrawLockup } from "@/lib/contracts";
import { formatUnits } from "viem";

// Helper to format token amount based on token type
// USDC/USDT: 2 decimal places, others: 6 decimals for small amounts, M/K for large
function formatTokenAmount(
  amount: string,
  currency: string,
  decimals: number = 18
): string {
  try {
    const formatted = formatUnits(BigInt(amount), decimals);
    const num = parseFloat(formatted);

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

// Helper to format countdown
function formatCountdown(targetTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = targetTimestamp - now;

  if (diff <= 0) return "可取出";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) {
    return `${days}天 ${hours}小时`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

// Countdown component that updates every second
function Countdown({
  targetTimestamp,
  onReady,
}: {
  targetTimestamp: number;
  onReady?: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(formatCountdown(targetTimestamp));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check initial state on mount to avoid hydration mismatch
    const now = Math.floor(Date.now() / 1000);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(targetTimestamp <= now);

    const timer = setInterval(() => {
      const currentNow = Math.floor(Date.now() / 1000);
      if (targetTimestamp <= currentNow) {
        setTimeLeft("可取出");
        setIsReady(true);
        onReady?.();
        clearInterval(timer);
      } else {
        setTimeLeft(formatCountdown(targetTimestamp));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp, onReady]);

  return (
    <span
      className={isReady ? "font-semibold text-emerald-500" : "text-amber-500"}
    >
      {isReady ? (
        <span className="flex items-center gap-1">
          <Unlock className="h-3 w-3" />
          {timeLeft}
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          {timeLeft}
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
  const { isConnected } = useAccount();
  const { withdraw, isPending: isWithdrawing } = useWithdraw();
  const { withdrawLockup, isPending: isWithdrawingLockup } =
    useWithdrawLockup();

  // Fix hydration mismatch - only use wallet state after client mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleWithdraw = async (position: Position) => {
    try {
      // Parse ID to get type and index
      const [type, idStr] = position.id.split("-");
      const id = BigInt(idStr);

      if (type === "deposit") {
        await withdraw(id);
        toast.success(t("toast.withdrawSuccess.title"), {
          description: "Withdrawal initiated. Please confirm in your wallet.",
        });
      } else if (type === "lockup") {
        await withdrawLockup(id);
        toast.success(t("toast.withdrawSuccess.title"), {
          description:
            "Lockup withdrawal initiated. Please confirm in your wallet.",
        });
      }

      // Refresh positions after a delay
      setTimeout(() => onRefresh?.(), 2000);
    } catch (err) {
      toast.error("Withdraw failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

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
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
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
        {!mounted ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-500" />
            <p className="text-slate-500 dark:text-slate-400">Loading...</p>
          </div>
        ) : !isConnected ? (
          <div className="py-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              Connect wallet to view positions
            </p>
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-500" />
            <p className="text-slate-500 dark:text-slate-400">
              Loading positions from chain...
            </p>
          </div>
        ) : positions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              {t("positions.empty")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {positions.map((position) => {
              // Determine if withdraw button should be enabled
              const canWithdrawNow = position.canWithdraw ?? false;
              const isProcessing = isWithdrawing || isWithdrawingLockup;

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

              return (
                <div
                  key={position.id}
                  className="rounded-lg border border-slate-200/50 bg-slate-100/80 p-4 transition-colors hover:border-emerald-500/50 sm:p-5 dark:border-slate-700/50 dark:bg-slate-800/50"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex-1 space-y-3">
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
                            position.status === "active"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {position.status === "active"
                            ? t("positions.status.active")
                            : t("positions.status.completed")}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 sm:gap-4">
                        {/* Total Amount */}
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                          <div className="min-w-0">
                            <p className="text-xs text-slate-800 dark:text-slate-300">
                              {position.type === "u-based"
                                ? "总金额"
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

                        {/* For u-based: show per-period amount and remaining */}
                        {position.type === "u-based" && (
                          <>
                            <div className="flex items-center gap-2">
                              <Coins className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                              <div className="min-w-0">
                                <p className="text-xs text-slate-800 dark:text-slate-300">
                                  每期金额
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
                            <div className="flex items-center gap-2">
                              <Repeat className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                              <div className="min-w-0">
                                <p className="text-xs text-slate-800 dark:text-slate-300">
                                  {t("positions.fields.remaining")}
                                </p>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">
                                  {position.remaining}/{position.frequency}
                                </p>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Period/Lock time */}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                          <div className="min-w-0">
                            <p className="text-xs text-slate-800 dark:text-slate-300">
                              {position.type === "u-based"
                                ? t("positions.fields.period")
                                : "锁定期"}
                            </p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {position.period} {t("positions.fields.days")}
                            </p>
                          </div>
                        </div>

                        {/* Countdown / Next withdraw time */}
                        {position.status === "active" && nextWithdrawTime && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                            <div className="min-w-0">
                              <p className="text-xs text-slate-800 dark:text-slate-300">
                                {position.type === "u-based"
                                  ? "下次可取"
                                  : "解锁倒计时"}
                              </p>
                              <Countdown
                                targetTimestamp={nextWithdrawTime}
                                onReady={() => onRefresh?.()}
                              />
                            </div>
                          </div>
                        )}

                        {/* Start date */}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                          <div className="min-w-0">
                            <p className="text-xs text-slate-800 dark:text-slate-300">
                              {t("positions.fields.startDate")}
                            </p>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {position.startDate}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Withdrawable amount hint for u-based */}
                      {position.type === "u-based" &&
                        (position.withdrawableNow ?? 0) > 0 &&
                        canWithdrawNow && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            当前可取出 {position.withdrawableNow} 期，共{" "}
                            {(
                              parseFloat(position.amount) *
                              (position.withdrawableNow ?? 0)
                            ).toFixed(2)}{" "}
                            {position.currency}
                          </p>
                        )}
                    </div>

                    <div className="flex gap-2 sm:flex-col">
                      {position.status === "active" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 sm:flex-none"
                          onClick={() => handleWithdraw(position)}
                          disabled={!canWithdrawNow || isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : null}
                          {t("positions.actions.withdraw")}
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
    </div>
  );
}
