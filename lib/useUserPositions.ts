"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, http, zeroAddress } from "viem";
import { hardhat, bsc, bscTestnet, arbitrum, xLayer } from "viem/chains";
import {
  CHAIN_IDS,
  getWarehouseAddress,
  getTokenAddress,
} from "@/lib/constants";
import { warehouseAbi, erc20Abi } from "@/lib/abi";

// Helper to get token symbol from address
function getKnownTokenSymbol(
  tokenAddress: string,
  chainId: number
): string | null {
  const addr = tokenAddress.toLowerCase();

  // Native token (address(0))
  if (addr === zeroAddress.toLowerCase()) {
    switch (chainId) {
      case CHAIN_IDS.XLAYER:
        return "OKB";
      case CHAIN_IDS.BSC:
      case CHAIN_IDS.BSC_TESTNET:
        return "BNB";
      case CHAIN_IDS.ARBITRUM:
        return "ETH";
      default:
        return "ETH";
    }
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

// Define supported chains with their configurations
const SUPPORTED_CHAINS = [
  {
    chainId: CHAIN_IDS.HARDHAT,
    chain: hardhat,
    rpcUrl: "http://127.0.0.1:8545",
    name: "Localnet",
  },
  {
    chainId: CHAIN_IDS.XLAYER,
    chain: xLayer,
    name: "X Layer",
  },
  {
    chainId: CHAIN_IDS.BSC,
    chain: bsc,
    name: "BNB Chain",
  },
  {
    chainId: CHAIN_IDS.BSC_TESTNET,
    chain: bscTestnet,
    name: "BSC Testnet",
  },
  {
    chainId: CHAIN_IDS.ARBITRUM,
    chain: arbitrum,
    name: "Arbitrum",
  },
];

export interface Position {
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
}

interface LockupData {
  user: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  unlockTime: bigint;
  withdrawn: boolean;
  isDiscountActive: boolean;
  createTime: bigint;
}

// Fetch positions for a single chain
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

    // Fetch next IDs to know the range
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

    // Fetch all deposits and filter by user
    for (let i = 0n; i < nextDepositId; i++) {
      try {
        const result = (await client.readContract({
          address: warehouseAddress as `0x${string}`,
          abi: warehouseAbi,
          functionName: "deposits",
          args: [i],
        })) as [string, string, bigint, bigint, number, number, bigint];

        const deposit: DepositData = {
          user: result[0] as `0x${string}`,
          token: result[1] as `0x${string}`,
          amountPerPeriod: result[2],
          periodSeconds: result[3],
          totalPeriods: result[4],
          periodsWithdrawn: result[5],
          nextWithdrawalTime: result[6],
        };

        // Check if this deposit belongs to the user and is still active
        if (
          deposit.user.toLowerCase() === userAddressLower &&
          deposit.periodsWithdrawn < deposit.totalPeriods
        ) {
          const periodSeconds = Number(deposit.periodSeconds);
          const totalPeriods = deposit.totalPeriods;
          const periodsWithdrawn = deposit.periodsWithdrawn;
          const periodDays = Math.round(periodSeconds / 86400);

          const now = Math.floor(Date.now() / 1000);
          const nextWithdrawTime = Number(deposit.nextWithdrawalTime);
          const remaining = totalPeriods - periodsWithdrawn;
          const canWithdraw = now >= nextWithdrawTime && remaining > 0;

          // Calculate withdrawable periods
          let withdrawableNow = 0;
          if (canWithdraw) {
            const timeSinceNext = now - nextWithdrawTime;
            withdrawableNow = Math.min(
              remaining,
              1 + Math.floor(timeSinceNext / periodSeconds)
            );
          }

          // Calculate total amount
          const totalAmount = deposit.amountPerPeriod * BigInt(totalPeriods);

          // Get token symbol and decimals
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
            id: `deposit-${chainConfig.chainId}-${i}`,
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
          });
        }
      } catch {
        // Skip failed reads
      }
    }

    // Fetch all lockups and filter by user
    for (let i = 0n; i < nextLockupId; i++) {
      try {
        const result = (await client.readContract({
          address: warehouseAddress as `0x${string}`,
          abi: warehouseAbi,
          functionName: "lockups",
          args: [i],
        })) as [string, string, bigint, bigint, boolean, boolean, bigint];

        const lockup: LockupData = {
          user: result[0] as `0x${string}`,
          token: result[1] as `0x${string}`,
          amount: result[2],
          unlockTime: result[3],
          withdrawn: result[4],
          isDiscountActive: result[5],
          createTime: result[6],
        };

        // Check if this lockup belongs to the user and is not withdrawn
        if (
          lockup.user.toLowerCase() === userAddressLower &&
          !lockup.withdrawn
        ) {
          const unlockTime = Number(lockup.unlockTime);
          const createTime = Number(lockup.createTime);
          const now = Math.floor(Date.now() / 1000);
          const canWithdraw = now >= unlockTime;

          // Calculate period in days (from create to unlock)
          const periodDays = Math.max(
            0,
            Math.round((unlockTime - createTime) / 86400)
          );

          // Get token symbol and decimals
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
            id: `lockup-${chainConfig.chainId}-${i}`,
            type: "coin-based",
            amount: lockup.amount.toString(),
            currency: tokenSymbol,
            decimals: tokenDecimals,
            period: periodDays,
            startDate: new Date(createTime * 1000).toISOString().split("T")[0],
            status: canWithdraw ? "completed" : "active",
            chain: chainConfig.name,
            chainId: chainConfig.chainId,
            unlockTime,
            canWithdraw,
            tokenAddress: lockup.token,
          });
        }
      } catch {
        // Skip failed reads
      }
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
