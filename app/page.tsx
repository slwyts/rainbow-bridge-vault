"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { DepositForm } from "@/components/deposit-form";
import { PositionsList } from "@/components/positions-list";
import { AnimatedBackground } from "@/components/animated-background";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider, useI18n } from "@/components/i18n-provider";

export type Position = {
  id: string;
  type: "u-based" | "coin-based";
  amount: string;
  currency: string;
  frequency?: number;
  period: number;
  remaining?: number;
  startDate: string;
  status: "active" | "completed";
  chain: string;
};

function HomePage() {
  const { t } = useI18n();
  const [positions, setPositions] = useState<Position[]>([
    {
      id: "1",
      type: "u-based",
      amount: "10",
      currency: "USDT",
      frequency: 7,
      period: 7,
      remaining: 5,
      startDate: "2025-01-15",
      status: "active",
      chain: "XLayer",
    },
    {
      id: "2",
      type: "coin-based",
      amount: "0.5",
      currency: "ETH",
      period: 30,
      startDate: "2025-01-10",
      status: "active",
      chain: "Ethereum",
    },
  ]);

  const addPosition = (position: Omit<Position, "id">) => {
    setPositions((prev) => [
      ...prev,
      { ...position, id: Date.now().toString() },
    ]);
  };

  const removePosition = (id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <DepositForm onAddPosition={addPosition} />
        </div>

        <div className="mt-12 max-w-6xl mx-auto">
          <PositionsList
            positions={positions}
            onRemovePosition={removePosition}
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
