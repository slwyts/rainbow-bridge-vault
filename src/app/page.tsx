"use client";

import { Header } from "@/components/header";
import { DepositForm } from "@/components/deposit-form";
import { PositionsList } from "@/components/positions-list";
import { AnimatedBackground } from "@/components/animated-background";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { useUserPositions } from "@/lib/useUserPositions";

export type Position = {
  id: string;
  type: "u-based" | "coin-based";
  amount: string; // For u-based: per-period amount, for coin-based: total amount
  totalAmount?: string; // Total amount (calculated for u-based)
  currency: string;
  decimals?: number; // Token decimals (e.g., 6 for USDT/USDC, 18 for most ERC20)
  frequency?: number; // Total periods (u-based only)
  period: number; // Period in days
  remaining?: number; // Remaining periods (u-based only)
  startDate: string;
  status: "active" | "completed";
  chain: string;
  chainId?: number; // Numeric chain ID for multi-chain support
  // New fields for time tracking
  nextWithdrawTime?: number; // Unix timestamp for next withdrawal (u-based)
  unlockTime?: number; // Unix timestamp for unlock (coin-based)
  canWithdraw: boolean; // Whether withdrawal is currently possible
  withdrawableNow?: number; // How many periods can be withdrawn now (u-based)
  remittanceEnabled?: boolean;
  createdAsRemit?: boolean;
};

function HomePage() {
  const { t } = useI18n();
  // Fetch positions from contract
  const { positions, isLoading, refetch } = useUserPositions();

  // Called after successful deposit/lockup - refetch from chain
  const handlePositionAdded = () => {
    // Delay to allow chain state to update
    setTimeout(() => {
      refetch();
    }, 2000);
  };

  // Called when user withdraws - refetch from chain
  const handleWithdraw = (id: string) => {
    // For now, just refetch. Actual withdraw will be implemented in positions-list
    refetch();
  };

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />

      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <DepositForm onAddPosition={handlePositionAdded} />
        </div>

        <div className="mx-auto mt-12 max-w-6xl">
          <PositionsList
            positions={positions}
            isLoading={isLoading}
            onRemovePosition={handleWithdraw}
            onRefresh={refetch}
          />
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <I18nProvider>
        <HomePage />
      </I18nProvider>
    </ThemeProvider>
  );
}
