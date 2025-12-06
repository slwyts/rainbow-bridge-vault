"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { Wallet } from "lucide-react";

export function WalletConnect() {
  const { t } = useI18n();
  const [connected, setConnected] = useState(false);

  return (
    <Button
      onClick={() => setConnected(!connected)}
      className={connected ? "bg-linear-to-r from-chart-1 to-chart-3" : ""}
    >
      <Wallet className="w-4 h-4 mr-2" />
      {connected ? t("wallet.connected") : t("wallet.connect")}
    </Button>
  );
}
