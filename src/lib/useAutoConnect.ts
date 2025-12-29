"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect, useSwitchChain, useChainId } from "wagmi";
import { CHAIN_CONFIGS, getAllChainIds, type SupportedChainId } from "./chains";

// 获取默认链ID
const DEFAULT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || 196
) as SupportedChainId;

/**
 * 自动连接钱包并切换到正确链的 hook
 * - 页面加载时自动尝试连接钱包
 * - 连接后自动切换到默认链
 * - 如果钱包没有目标链，会请求添加网络
 */
export function useAutoConnect() {
  const { isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const connectedChainId = useChainId();

  // 使用 ref 防止重复执行
  const hasTriedConnect = useRef(false);
  const hasTriedSwitchChain = useRef(false);

  // 获取所有启用的链ID
  const enabledChainIds = getAllChainIds();

  // 确定目标链：优先使用默认链，如果默认链未启用则使用第一个启用的链
  const targetChainId = enabledChainIds.includes(DEFAULT_CHAIN_ID)
    ? DEFAULT_CHAIN_ID
    : enabledChainIds[0];

  // 自动连接钱包
  useEffect(() => {
    // 只尝试一次
    if (hasTriedConnect.current) return;
    // 如果已经连接或正在连接，跳过
    if (isConnected || isConnecting) return;

    hasTriedConnect.current = true;

    // 查找 injected connector (MetaMask, etc.)
    const injectedConnector = connectors.find((c) => c.id === "injected");
    if (injectedConnector) {
      // 静默连接 - 不显示错误（用户可能没有之前连接过）
      connect(
        { connector: injectedConnector },
        {
          onError: () => {
            // 静默失败 - 用户需要手动连接
          },
        }
      );
    }
  }, [isConnected, isConnecting, connect, connectors]);

  // 自动切换到目标链
  useEffect(() => {
    // 只在连接后执行一次
    if (!isConnected) return;
    if (hasTriedSwitchChain.current) return;
    // 如果已经在目标链上，跳过
    if (connectedChainId === targetChainId) return;
    // 如果 switchChain 不可用，跳过
    if (!switchChain) return;

    hasTriedSwitchChain.current = true;

    // 切换到目标链
    // wagmi 的 switchChain 会自动处理添加网络（如果钱包不存在该链）
    switchChain(
      { chainId: targetChainId },
      {
        onError: (error) => {
          console.warn("Auto switch chain failed:", error.message);
          // 静默失败 - 用户可以手动切换
        },
      }
    );
  }, [isConnected, connectedChainId, targetChainId, switchChain]);

  return {
    isAutoConnecting: !hasTriedConnect.current && !isConnected && !isConnecting,
    targetChainId,
  };
}
