"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function WalletConnect() {
  const { t } = useI18n();
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  // Fix hydration mismatch - only render wallet state after client mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to format address
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = () => {
    // Prefer injected connector or the first available one
    const connector = connectors.find((c) => c.id === 'injected') || connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  // Before mount, show consistent loading state to prevent hydration mismatch
  if (!mounted) {
    return (
      <Button disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        {t("wallet.connect")}
      </Button>
    );
  }

  if (isConnected && address) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button className="bg-linear-to-r from-chart-1 to-chart-3">
            <Wallet className="w-4 h-4 mr-2" />
            {formatAddress(address)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2">
          <div className="flex flex-col gap-2">
            <div className="text-xs text-muted-foreground px-2 py-1">
              {t("wallet.connected")}
            </div>
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full justify-start"
              onClick={() => disconnect()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t("wallet.disconnect")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button disabled={isConnecting} onClick={handleConnect}>
      {isConnecting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Wallet className="w-4 h-4 mr-2" />
      )}
      {t("wallet.connect")}
    </Button>
  );
}
