"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { TrendingUp, Calendar, Repeat, Coins, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import type { Position } from "@/app/page";

interface PositionsListProps {
  positions: Position[];
  onRemovePosition: (id: string) => void;
}

export function PositionsList({
  positions,
  onRemovePosition,
}: PositionsListProps) {
  const { t } = useI18n();

  const handleWithdraw = (position: Position) => {
    onRemovePosition(position.id);
    toast.success(t("toast.withdrawSuccess.title"), {
      description: t("toast.withdrawSuccess.description"),
    });
  };

  return (
    <div className="overflow-hidden border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-2xl rounded-2xl">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-white/50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="hidden sm:flex items-center gap-3">
          <FolderOpen className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span className="text-slate-500 dark:text-slate-400 text-sm font-mono">
            my-positions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {t("positions.title")}
          </h2>
        </div>
      </div>

      {/* Content area */}
      <div className="p-4 sm:p-6 space-y-4">
        {positions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              {t("positions.empty")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {positions.map((position) => (
              <div
                key={position.id}
                className="p-4 sm:p-5 rounded-lg bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:border-emerald-500/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-linear-to-r from-emerald-500 to-green-500 text-white border-0">
                        {position.type === "u-based"
                          ? t("positions.types.uBased")
                          : t("positions.types.coinBased")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
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
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-slate-800 dark:text-slate-300 text-xs">
                            {t("positions.fields.amount")}
                          </p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {position.amount} {position.currency}
                          </p>
                        </div>
                      </div>

                      {position.type === "u-based" && (
                        <div className="flex items-center gap-2">
                          <Repeat className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-slate-800 dark:text-slate-300 text-xs">
                              {t("positions.fields.remaining")}
                            </p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {position.remaining}/{position.frequency}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-slate-800 dark:text-slate-300 text-xs">
                            {t("positions.fields.period")}
                          </p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {position.period} {t("positions.fields.days")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-slate-800 dark:text-slate-300 text-xs">
                            {t("positions.fields.startDate")}
                          </p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {position.startDate}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col gap-2">
                    {position.status === "active" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 sm:flex-none"
                        onClick={() => handleWithdraw(position)}
                      >
                        {t("positions.actions.withdraw")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
