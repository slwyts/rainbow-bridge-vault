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
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
              <span className="text-slate-600 dark:text-slate-400 text-sm font-mono flex items-center gap-2">
                <FileText className="w-4 h-4" />
                about.md
              </span>
            </div>

            <div className="p-8">
              <h1 className="text-4xl font-bold mb-4 bg-clip-text from-emerald-400 via-cyan-400 to-violet-400">
                {t("about.title")}
              </h1>
              <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
                {t("about.description")}
              </p>
            </div>
          </div>

          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
              <span className="text-slate-600 dark:text-slate-400 text-sm font-mono flex items-center gap-2">
                <Braces className="w-4 h-4" />
                features.json
              </span>
            </div>

            <div className="p-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                {t("about.features.title")}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {features.map(({ icon: Icon, key, color }) => (
                  <div
                    key={key}
                    className="group flex items-start gap-4 p-5 rounded-xl bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                  >
                    <div
                      className={`p-3 rounded-xl bg-linear-to-br ${color} shadow-lg shrink-0`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
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

          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
              <span className="text-slate-600 dark:text-slate-400 text-sm font-mono flex items-center gap-2">
                <Skull className="w-4 h-4" />
                risks.log
              </span>
            </div>

            <div className="p-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {t("about.risks.title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {t("about.risks.subtitle")}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {riskCases.map((trader, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-xl bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50"
                  >
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
                      {trader.nameKey
                        ? t(`about.risks.traders.${trader.nameKey}`)
                        : trader.name}
                    </h3>
                    <p className="text-xs px-2 py-1 rounded-full bg-slate-200/80 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 inline-block mb-4">
                      {t(`about.risks.strategies.${trader.strategy}`)}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mb-1">
                          {t("about.risks.peakMoment")}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                          {t(`about.risks.peakDescs.${trader.peakDesc}`)}
                        </p>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {trader.peakAmount}
                          {t("about.risks.unit")}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mb-1">
                          {t("about.risks.finalResult")}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
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

          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-red-300 dark:border-red-500/30 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-b border-red-200 dark:border-red-500/20">
              <span className="text-red-600 dark:text-red-400 text-sm font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                warning.log
              </span>
            </div>

            <div className="p-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {t("about.targetUsers.title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {t("about.targetUsers.subtitle")}
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                {targetUsers.map((key) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-4 rounded-xl bg-red-50/80 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 hover:bg-red-100/80 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {t(`about.targetUsers.${key}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-amber-300 dark:border-amber-500/30 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-b border-amber-200 dark:border-amber-500/20">
              <span className="text-amber-600 dark:text-amber-400 text-sm font-mono flex items-center gap-2">
                <Coins className="w-4 h-4" />
                token-config.ts
              </span>
            </div>

            <div className="p-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                {t("about.tokenInfo.title")}
              </h2>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="p-5 rounded-xl bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    {t("about.tokenInfo.chain")}
                  </p>
                  <p className="text-slate-900 dark:text-white font-bold text-lg">
                    X Layer (XLayer)
                  </p>
                </div>
                <div className="p-5 rounded-xl bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    {t("about.tokenInfo.name")}
                  </p>
                  <p className="text-slate-900 dark:text-white font-bold text-lg">
                    xwaifu
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 mb-6">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  {t("about.tokenInfo.address")}
                </p>
                <code className="text-amber-600 dark:text-amber-400 text-sm font-mono break-all">
                  0x140aba9691353ed54479372c4e9580d558d954b1
                </code>
              </div>

              <div className="p-5 rounded-xl bg-linear-to-r from-amber-100/80 to-orange-100/80 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-300 dark:border-amber-500/30 mb-6">
                <p className="text-amber-800 dark:text-amber-200">
                  {t("about.tokenInfo.benefits")}
                </p>
              </div>

              <Button className="h-12 px-8 bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02]">
                {t("about.tokenInfo.buyButton")}
                <ArrowRight className="w-5 h-5 ml-2" />
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
