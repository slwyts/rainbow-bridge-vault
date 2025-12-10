"use client";

import { Header } from "@/components/header";
import { AnimatedBackground } from "@/components/animated-background";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import {
  ShieldCheck,
  Target,
  Users,
  Zap,
  AlertTriangle,
  Coins,
  ArrowRight,
  CheckCircle2,
  Skull,
  FileText,
  Braces,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function AboutContent() {
  const { t } = useI18n();

  const features = [
    {
      icon: ShieldCheck,
      key: "feature1",
      color: "from-emerald-500 to-green-500",
    },
    { icon: Target, key: "feature2", color: "from-violet-500 to-purple-500" },
    { icon: Users, key: "feature3", color: "from-blue-500 to-cyan-500" },
    { icon: Zap, key: "feature4", color: "from-amber-500 to-orange-500" },
  ];

  const targetUsers = [
    "noStopLoss",
    "allIn",
    "highLeverage",
    "noReserve",
    "cantHold",
    "impatient",
    "shortSmallCoins",
    "watchesMarket",
  ];

  const riskCases = [
    {
      name: "James Wynn",
      strategy: "highLeverage20x",
      peakDesc: "jamesWynnPeak",
      peakAmount: "8700",
      finalDesc: "lostAllProfitAndPrincipal",
      finalAmount: "-2177",
      finalUnit: "usd",
    },
    {
      name: "qwatio",
      strategy: "highLeverage20x",
      peakDesc: "qwatioPeak",
      peakAmount: "2600",
      finalDesc: "lostAllProfitAndPrincipal",
      finalAmount: "0",
      finalUnit: "zero",
    },
    {
      name: "AguilaTrades",
      strategy: "highLeverage20x",
      peakDesc: "aguilaPeak",
      peakAmount: "4170",
      finalDesc: "lostAllProfit",
      finalAmount: "-3760",
      finalUnit: "cny",
    },
    {
      name: "100%Whale",
      nameKey: "whaleName",
      strategy: "highFrequency",
      peakDesc: "whalePeak",
      peakAmount: "3199",
      finalDesc: "lostAllProfit",
      finalAmount: "-3002",
      finalUnit: "cny",
    },
  ];

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/50 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/50">
              <span className="flex items-center gap-2 font-mono text-sm text-slate-600 dark:text-slate-400">
                <FileText className="h-4 w-4" />
                about.md
              </span>
            </div>

            <div className="p-8">
              <h1 className="mb-4 from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-4xl font-bold">
                {t("about.title")}
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                {t("about.description")}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/50 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/50">
              <span className="flex items-center gap-2 font-mono text-sm text-slate-600 dark:text-slate-400">
                <Braces className="h-4 w-4" />
                features.json
              </span>
            </div>

            <div className="p-8">
              <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">
                {t("about.features.title")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {features.map(({ icon: Icon, key, color }) => (
                  <div
                    key={key}
                    className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-100/50 p-5 transition-all hover:border-slate-300 dark:border-slate-700/50 dark:bg-slate-800/30 dark:hover:border-slate-600"
                  >
                    <div
                      className={`rounded-xl bg-linear-to-br p-3 ${color} shrink-0 shadow-lg`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">
                        {t(`about.features.${key}.title`)}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t(`about.features.${key}.description`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/50 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/50">
              <span className="flex items-center gap-2 font-mono text-sm text-slate-600 dark:text-slate-400">
                <Skull className="h-4 w-4" />
                risks.log
              </span>
            </div>

            <div className="p-8">
              <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
                {t("about.risks.title")}
              </h2>
              <p className="mb-6 text-slate-600 dark:text-slate-400">
                {t("about.risks.subtitle")}
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {riskCases.map((trader, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 bg-slate-100/50 p-5 dark:border-slate-700/50 dark:bg-slate-800/30"
                  >
                    <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                      {trader.nameKey
                        ? t(`about.risks.traders.${trader.nameKey}`)
                        : trader.name}
                    </h3>
                    <p className="mb-4 inline-block rounded-full bg-slate-200/80 px-2 py-1 text-xs text-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
                      {t(`about.risks.strategies.${trader.strategy}`)}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <p className="mb-1 text-xs text-slate-500 dark:text-slate-500">
                          {t("about.risks.peakMoment")}
                        </p>
                        <p className="mb-1 text-xs text-slate-600 dark:text-slate-400">
                          {t(`about.risks.peakDescs.${trader.peakDesc}`)}
                        </p>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {trader.peakAmount}
                          {t("about.risks.unit")}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500 dark:text-slate-500">
                          {t("about.risks.finalResult")}
                        </p>
                        <p className="mb-1 text-xs text-slate-600 dark:text-slate-400">
                          {t(`about.risks.finalDescs.${trader.finalDesc}`)}
                        </p>
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">
                          {trader.finalUnit === "zero"
                            ? t("about.risks.zero")
                            : trader.finalUnit === "usd"
                              ? `${t("about.risks.loss")}${Math.abs(Number(trader.finalAmount))}${t("about.risks.usdUnit")}`
                              : `${t("about.risks.loss")}${Math.abs(Number(trader.finalAmount))}${t("about.risks.unit")}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-red-300 bg-white/50 shadow-2xl backdrop-blur-xl dark:border-red-500/30 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 border-b border-red-200 bg-slate-100/50 px-6 py-4 dark:border-red-500/20 dark:bg-slate-800/50">
              <span className="flex items-center gap-2 font-mono text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                warning.log
              </span>
            </div>

            <div className="p-8">
              <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
                {t("about.targetUsers.title")}
              </h2>
              <p className="mb-6 text-slate-600 dark:text-slate-400">
                {t("about.targetUsers.subtitle")}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {targetUsers.map((key) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 transition-colors hover:bg-red-100/80 dark:border-red-500/20 dark:bg-red-500/5 dark:hover:bg-red-500/10"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {t(`about.targetUsers.${key}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-300 bg-white/50 shadow-2xl backdrop-blur-xl dark:border-amber-500/30 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 border-b border-amber-200 bg-slate-100/50 px-6 py-4 dark:border-amber-500/20 dark:bg-slate-800/50">
              <span className="flex items-center gap-2 font-mono text-sm text-amber-600 dark:text-amber-400">
                <Coins className="h-4 w-4" />
                token-config.ts
              </span>
            </div>

            <div className="p-8">
              <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">
                {t("about.tokenInfo.title")}
              </h2>

              <div className="mb-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-100/50 p-5 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <p className="mb-2 text-xs tracking-wider text-slate-500 uppercase">
                    {t("about.tokenInfo.chain")}
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    X Layer (XLayer)
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-100/50 p-5 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <p className="mb-2 text-xs tracking-wider text-slate-500 uppercase">
                    {t("about.tokenInfo.name")}
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    xwaifu
                  </p>
                </div>
              </div>

              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-100/50 p-5 dark:border-slate-700/50 dark:bg-slate-800/30">
                <p className="mb-2 text-xs tracking-wider text-slate-500 uppercase">
                  {t("about.tokenInfo.address")}
                </p>
                <code className="font-mono text-sm break-all text-amber-600 dark:text-amber-400">
                  0x140aba9691353ed54479372c4e9580d558d954b1
                </code>
              </div>

              <div className="mb-6 rounded-xl border border-amber-300 bg-linear-to-r from-amber-100/80 to-orange-100/80 p-5 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-orange-500/10">
                <p className="text-amber-800 dark:text-amber-200">
                  {t("about.tokenInfo.benefits")}
                </p>
              </div>

              <Button className="h-12 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-8 font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] hover:from-amber-600 hover:to-orange-600">
                {t("about.tokenInfo.buyButton")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AboutPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <I18nProvider>
        <AboutContent />
      </I18nProvider>
    </ThemeProvider>
  );
}
