"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, http, zeroAddress } from "viem";
import {
  CHAIN_CONFIGS,
  getAllChainIds,
  getWarehouseAddress,
  getTokenAddress,
  getNativeTokenSymbol,
  type SupportedChainId,
} from "@/lib/chains";
import { warehouseAbi, erc20Abi } from "@/lib/abi";

// Helper to get token symbol from address
function getKnownTokenSymbol(
  tokenAddress: string,
  chainId: number
): string | null {
  const addr = tokenAddress.toLowerCase();

  // Native token (address(0))
  if (addr === zeroAddress.toLowerCase()) {
    return getNativeTokenSymbol(chainId);
  }

  // Check known tokens from constants
  const tokens = ["USDT", "USDC", "XWAIFU"] as const;
  for (const symbol of tokens) {
    const knownAddr = getTokenAddress(chainId, symbol);
    if (knownAddr && knownAddr.toLowerCase() === addr) {
      return symbol;
    }
  }

  return null;
}

// Cache for token symbols to avoid repeated RPC calls
const tokenSymbolCache = new Map<string, string>();

// Fetch token symbol from contract
async function fetchTokenSymbol(
  client: ReturnType<typeof createPublicClient>,
  tokenAddress: string,
  chainId: number
): Promise<string> {
  // Check if it's a known token first
  const known = getKnownTokenSymbol(tokenAddress, chainId);
  if (known) return known;

  // Check cache
  const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}`;
  if (tokenSymbolCache.has(cacheKey)) {
    return tokenSymbolCache.get(cacheKey)!;
  }

  // Fetch from contract
  try {
    const symbol = (await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "symbol",
    })) as string;

    tokenSymbolCache.set(cacheKey, symbol);
    return symbol;
  } catch {
    // Return truncated address as fallback
    const short = `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
    tokenSymbolCache.set(cacheKey, short);
    return short;
  }
}

// Cache for token decimals
const tokenDecimalsCache = new Map<string, number>();

// Fetch token decimals from contract
async function fetchTokenDecimals(
  client: ReturnType<typeof createPublicClient>,
  tokenAddress: string,
  chainId: number
): Promise<number> {
  const addr = tokenAddress.toLowerCase();

  // Native token (address(0)) has 18 decimals
  if (addr === zeroAddress.toLowerCase()) {
    return 18;
  }

  // Check cache
  const cacheKey = `${chainId}-${addr}`;
  if (tokenDecimalsCache.has(cacheKey)) {
    return tokenDecimalsCache.get(cacheKey)!;
  }

  // Fetch from contract
  try {
    const decimals = (await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "decimals",
    })) as number;

    tokenDecimalsCache.set(cacheKey, decimals);
    return decimals;
  } catch {
    // Default to 18 if call fails
    tokenDecimalsCache.set(cacheKey, 18);
    return 18;
  }
}

// 从统一配置生成支持的链列表
const SUPPORTED_CHAINS = getAllChainIds().map((chainId) => {
  const config = CHAIN_CONFIGS[chainId as SupportedChainId];
  return {
    chainId: config.chainId,
    chain: config.viemChain,
    rpcUrl: config.rpcUrl,
    name: config.name,
  };
});

interface Position {
  id: string;
  type: "u-based" | "coin-based";
  amount: string; // For u-based: per-period amount, for coin-based: total amount
  totalAmount?: string; // Total amount (calculated for u-based)
  currency: string;
  decimals: number; // Token decimals for display formatting
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
  // Internal fields for contract operations
  tokenAddress?: string;
  remittanceEnabled?: boolean;
  createdAsRemit?: boolean;
  // VIP discount status (only for xwaifu lockups on X Layer)
  isDiscountActive?: boolean;
  createTime?: number; // Unix timestamp for lockup creation
}

// Data returned from contract - matches actual ABI
interface DepositData {
  user: `0x${string}`;
  token: `0x${string}`;
  amountPerPeriod: bigint;
  periodSeconds: bigint;
  totalPeriods: number;
  periodsWithdrawn: number;
  nextWithdrawalTime: bigint;
  remittanceEnabled: boolean;
  createdAsRemit: boolean;
}

interface LockupData {
  user: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  unlockTime: bigint;
  withdrawn: boolean;
  isDiscountActive: boolean;
  createTime: bigint;
  remittanceEnabled: boolean;
  createdAsRemit: boolean;
}

// Fetch positions for a single chain using batch functions (with fallback)
async function fetchPositionsForChain(
  chainConfig: (typeof SUPPORTED_CHAINS)[0],
  userAddress: string
): Promise<Position[]> {
  const positions: Position[] = [];

  try {
    const warehouseAddress = getWarehouseAddress(chainConfig.chainId);
    if (
      !warehouseAddress ||
      warehouseAddress === "0x0000000000000000000000000000000000000000"
    ) {
      return positions;
    }

    const client = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });

    // 获取区块链时间（严格使用链上时间，不用本地时间）
    const block = await client.getBlock();
    const blockchainNow = Number(block.timestamp);

    // Try batch fetch first, fallback to legacy method
    let depositIds: bigint[] = [];
    let depositsData: DepositData[] = [];
    let lockupIds: bigint[] = [];
    let lockupsData: LockupData[] = [];
    let useLegacy = false;

    try {
      // Try new batch functions
      const [depositsResult, lockupsResult] = await Promise.all([
        client.readContract({
          address: warehouseAddress as `0x${string}`,
          abi: warehouseAbi,
          functionName: "getUserDeposits",
          args: [userAddress as `0x${string}`],
        }),
        client.readContract({
          address: warehouseAddress as `0x${string}`,
          abi: warehouseAbi,
          functionName: "getUserLockups",
          args: [userAddress as `0x${string}`],
        }),
      ]);

      const [dIds, dData] = depositsResult as [bigint[], DepositData[]];
      const [lIds, lData] = lockupsResult as [bigint[], LockupData[]];
      depositIds = dIds;
      depositsData = dData;
      lockupIds = lIds;
      lockupsData = lData;
    } catch {
      // Batch functions not available, use legacy method
      useLegacy = true;
    }

    if (useLegacy) {
      // Fallback: fetch all and filter by user
      let nextDepositId = 0n;
      let nextLockupId = 0n;

      try {
        nextDepositId = (await client.readContract({
          address: warehouseAddress as `0x${string}`,
          abi: warehouseAbi,
          functionName: "nextDepositId",
        })) as bigint;
      } catch {
        // Contract might not exist on this chain
      }

      try {
        nextLockupId = (await client.readContract({
          address: warehouseAddress as `0x${string}`,
          abi: warehouseAbi,
          functionName: "nextLockupId",
        })) as bigint;
      } catch {
        // Contract might not exist on this chain
      }

      const userAddressLower = userAddress.toLowerCase();

      for (let i = 0n; i < nextDepositId; i++) {
        try {
          const result = (await client.readContract({
            address: warehouseAddress as `0x${string}`,
            abi: warehouseAbi,
            functionName: "deposits",
            args: [i],
          })) as [string, string, bigint, bigint, number, number, bigint, boolean, boolean];

          const deposit: DepositData = {
            user: result[0] as `0x${string}`,
            token: result[1] as `0x${string}`,
            amountPerPeriod: result[2],
            periodSeconds: result[3],
            totalPeriods: result[4],
            periodsWithdrawn: result[5],
            nextWithdrawalTime: result[6],
            remittanceEnabled: result[7],
            createdAsRemit: result[8],
          };

          if (deposit.user.toLowerCase() === userAddressLower) {
            depositIds.push(i);
            depositsData.push(deposit);
          }
        } catch {
          // Skip failed reads
        }
      }

      for (let i = 0n; i < nextLockupId; i++) {
        try {
          const result = (await client.readContract({
            address: warehouseAddress as `0x${string}`,
            abi: warehouseAbi,
            functionName: "lockups",
            args: [i],
          })) as [string, string, bigint, bigint, boolean, boolean, bigint, boolean, boolean];

          const lockup: LockupData = {
            user: result[0] as `0x${string}`,
            token: result[1] as `0x${string}`,
            amount: result[2],
            unlockTime: result[3],
            withdrawn: result[4],
            isDiscountActive: result[5],
            createTime: result[6],
            remittanceEnabled: result[7],
            createdAsRemit: result[8],
          };

          if (lockup.user.toLowerCase() === userAddressLower) {
            lockupIds.push(i);
            lockupsData.push(lockup);
          }
        } catch {
          // Skip failed reads
        }
      }
    }

    // Process deposits
    for (let idx = 0; idx < depositsData.length; idx++) {
      const deposit = depositsData[idx];
      const depositId = depositIds[idx];

      const periodSeconds = Number(deposit.periodSeconds);
      const totalPeriods = deposit.totalPeriods;
      const periodsWithdrawn = deposit.periodsWithdrawn;
      const periodDays = Math.round(periodSeconds / 86400);

      const nextWithdrawTime = Number(deposit.nextWithdrawalTime);
      const remaining = totalPeriods - periodsWithdrawn;
      const canWithdraw = blockchainNow >= nextWithdrawTime && remaining > 0;

      let withdrawableNow = 0;
      if (canWithdraw) {
        const timeSinceNext = blockchainNow - nextWithdrawTime;
        withdrawableNow = Math.min(
          remaining,
          1 + Math.floor(timeSinceNext / periodSeconds)
        );
      }

      const totalAmount = deposit.amountPerPeriod * BigInt(totalPeriods);

      const tokenSymbol = await fetchTokenSymbol(
        client,
        deposit.token,
        chainConfig.chainId
      );
      const tokenDecimals = await fetchTokenDecimals(
        client,
        deposit.token,
        chainConfig.chainId
      );

      positions.push({
        id: `deposit-${chainConfig.chainId}-${depositId}`,
        type: "u-based",
        amount: deposit.amountPerPeriod.toString(),
        totalAmount: totalAmount.toString(),
        currency: tokenSymbol,
        decimals: tokenDecimals,
        frequency: totalPeriods,
        period: periodDays,
        remaining,
        startDate: new Date((nextWithdrawTime - periodSeconds) * 1000)
          .toISOString()
          .split("T")[0],
        status: remaining === 0 ? "completed" : "active",
        chain: chainConfig.name,
        chainId: chainConfig.chainId,
        nextWithdrawTime,
        canWithdraw,
        withdrawableNow,
        tokenAddress: deposit.token,
        remittanceEnabled: deposit.remittanceEnabled,
        createdAsRemit: deposit.createdAsRemit,
      });
    }

    // Process lockups
    for (let idx = 0; idx < lockupsData.length; idx++) {
      const lockup = lockupsData[idx];
      const lockupId = lockupIds[idx];

      const unlockTime = Number(lockup.unlockTime);
      const createTime = Number(lockup.createTime);
      const canWithdraw = blockchainNow >= unlockTime;

      const periodDays = Math.max(
        0,
        Math.round((unlockTime - createTime) / 86400)
      );

      const tokenSymbol = await fetchTokenSymbol(
        client,
        lockup.token,
        chainConfig.chainId
      );
      const tokenDecimals = await fetchTokenDecimals(
        client,
        lockup.token,
        chainConfig.chainId
      );

      positions.push({
        id: `lockup-${chainConfig.chainId}-${lockupId}`,
        type: "coin-based",
        amount: lockup.amount.toString(),
        currency: tokenSymbol,
        decimals: tokenDecimals,
        period: periodDays,
        startDate: new Date(createTime * 1000).toISOString().split("T")[0],
        status: lockup.withdrawn ? "completed" : "active",
        chain: chainConfig.name,
        chainId: chainConfig.chainId,
        unlockTime,
        canWithdraw,
        tokenAddress: lockup.token,
        remittanceEnabled: lockup.remittanceEnabled,
        createdAsRemit: lockup.createdAsRemit,
        isDiscountActive: lockup.isDiscountActive,
        createTime,
      });
    }
  } catch {
    // Chain not available or contract error
  }

  return positions;
}

// Fetch positions from all chains
async function fetchAllPositions(userAddress: string): Promise<Position[]> {
  const allPositions: Position[] = [];

  // Fetch from all chains in parallel
  const results = await Promise.allSettled(
    SUPPORTED_CHAINS.map((chain) => fetchPositionsForChain(chain, userAddress))
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allPositions.push(...result.value);
    }
  }

  // Sort by chainId then by id
  allPositions.sort((a, b) => {
    const chainA = a.chainId ?? 0;
    const chainB = b.chainId ?? 0;
    if (chainA !== chainB) {
      return chainA - chainB;
    }
    return a.id.localeCompare(b.id);
  });

  return allPositions;
}

export function useUserPositions() {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!isConnected || !address) {
      setPositions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const allPositions = await fetchAllPositions(address);
      setPositions(allPositions);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch positions")
      );
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    positions,
    isLoading,
    error,
    refetch,
  };
}
