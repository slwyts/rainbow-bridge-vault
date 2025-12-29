"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { config } from "@/lib/web3";
import { useAutoConnect } from "@/lib/useAutoConnect";

// 内部组件：使用自动连接 hook
function AutoConnectHandler({ children }: { children: ReactNode }) {
  // 自动连接钱包并切换到默认链
  useAutoConnect();
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AutoConnectHandler>{children}</AutoConnectHandler>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
