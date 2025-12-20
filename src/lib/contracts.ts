import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useChainId,
  useBalance,
} from "wagmi";
import { parseUnits, zeroAddress } from "viem";
import { warehouseAbi, erc20Abi } from "./abi";
import { getWarehouseAddress, getChainName, CHAIN_IDS } from "./constants";

// Hook to get current chain's warehouse address
export function useWarehouseAddress(): `0x${string}` | undefined {
  const chainId = useChainId();
  return getWarehouseAddress(chainId);
}

// Hook to get current chain ID (for contract operations)
export function useContractChainId(): number {
  return useChainId();
}

// ============ Read Hooks ============

// Read a deposit by ID
export function useDeposit(depositId: bigint) {
  const warehouseAddress = useWarehouseAddress();
  const chainId = useContractChainId();

  return useReadContract({
    address: warehouseAddress,
    abi: warehouseAbi,
    functionName: "deposits",
    args: [depositId],
    chainId,
    query: { enabled: !!warehouseAddress },
  });
}

// Read a lockup by ID
export function useLockup(lockupId: bigint) {
  const warehouseAddress = useWarehouseAddress();
  const chainId = useContractChainId();

  return useReadContract({
    address: warehouseAddress,
    abi: warehouseAbi,
    functionName: "lockups",
    args: [lockupId],
    chainId,
    query: { enabled: !!warehouseAddress },
  });
}

// Read next deposit ID (to know how many deposits exist)
export function useNextDepositId() {
  const warehouseAddress = useWarehouseAddress();
  const chainId = useContractChainId();

  return useReadContract({
    address: warehouseAddress,
    abi: warehouseAbi,
    functionName: "nextDepositId",
    chainId,
    query: { enabled: !!warehouseAddress },
  });
}

// Read next lockup ID
export function useNextLockupId() {
  const warehouseAddress = useWarehouseAddress();
  const chainId = useContractChainId();

  return useReadContract({
    address: warehouseAddress,
    abi: warehouseAbi,
    functionName: "nextLockupId",
    chainId,
    query: { enabled: !!warehouseAddress },
  });
}

// Read user's deposit IDs
export function useUserDepositId(
  userAddress: `0x${string}` | undefined,
  index: bigint
) {
  const warehouseAddress = useWarehouseAddress();
  const chainId = useContractChainId();

  return useReadContract({
    address: warehouseAddress,
    abi: warehouseAbi,
    functionName: "userDepositIds",
    args: userAddress ? [userAddress, index] : undefined,
    chainId,
    query: { enabled: !!userAddress && !!warehouseAddress },
  });
}

// Read user's lockup IDs
export function useUserLockupId(
  userAddress: `0x${string}` | undefined,
  index: bigint
) {
  const warehouseAddress = useWarehouseAddress();
  const chainId = useContractChainId();

  return useReadContract({
    address: warehouseAddress,
    abi: warehouseAbi,
    functionName: "userLockupIds",
    args: userAddress ? [userAddress, index] : undefined,
    chainId,
    query: { enabled: !!userAddress && !!warehouseAddress },
  });
}

// Read ERC20 balance
export function useTokenBalance(
  tokenAddress: `0x${string}` | undefined,
  userAddress: `0x${string}` | undefined
) {
  const chainId = useContractChainId();

  return useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId,
    query: { enabled: !!tokenAddress && !!userAddress },
  });
}

// Read native token balance (ETH, BNB, OKB, etc.)
export function useNativeBalance(userAddress: `0x${string}` | undefined) {
  const chainId = useContractChainId();

  return useBalance({
    address: userAddress,
    chainId,
    query: { enabled: !!userAddress },
  });
}

// Read ERC20 decimals
export function useTokenDecimals(tokenAddress: `0x${string}` | undefined) {
  const chainId = useContractChainId();

  return useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    chainId,
    query: { enabled: !!tokenAddress },
  });
}

// Read ERC20 name
export function useTokenName(tokenAddress: `0x${string}` | undefined) {
  const chainId = useContractChainId();

  return useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "name",
    chainId,
    query: { enabled: !!tokenAddress },
  });
}

// Read ERC20 symbol
export function useTokenSymbol(tokenAddress: `0x${string}` | undefined) {
  const chainId = useContractChainId();

  return useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    chainId,
    query: { enabled: !!tokenAddress },
  });
}

// Combined hook to get all token info
export function useTokenInfo(tokenAddress: `0x${string}` | undefined) {
  const {
    data: name,
    isLoading: nameLoading,
    error: nameError,
  } = useTokenName(tokenAddress);
  const {
    data: symbol,
    isLoading: symbolLoading,
    error: symbolError,
  } = useTokenSymbol(tokenAddress);
  const {
    data: decimals,
    isLoading: decimalsLoading,
    error: decimalsError,
  } = useTokenDecimals(tokenAddress);

  const isLoading = nameLoading || symbolLoading || decimalsLoading;
  const error = nameError || symbolError || decimalsError;
  const isValid = !!name && !!symbol && decimals !== undefined && !error;

  return {
    name: name as string | undefined,
    symbol: symbol as string | undefined,
    decimals: decimals as number | undefined,
    isLoading,
    error,
    isValid,
  };
}

// Read ERC20 allowance
export function useTokenAllowance(
  tokenAddress: `0x${string}` | undefined,
  ownerAddress: `0x${string}` | undefined,
  spenderAddress: `0x${string}` | undefined
) {
  const chainId = useContractChainId();

  return useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      ownerAddress && spenderAddress
        ? [ownerAddress, spenderAddress]
        : undefined,
    chainId,
    query: { enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress },
  });
}

// ============ Write Hooks ============

// Hook to approve ERC20 spending
export function useApproveToken() {
  const warehouseAddress = useWarehouseAddress();
  const {
    writeContractAsync,
    data: hash,
    isPending,
    error,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = async (tokenAddress: `0x${string}`, amount: bigint) => {
    if (!warehouseAddress)
      throw new Error("Warehouse not deployed on this chain");
    const txHash = await writeContractAsync({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [warehouseAddress, amount],
    });
    return txHash;
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

// Hook to create a U-based deposit
export function useCreateDeposit() {
  const warehouseAddress = useWarehouseAddress();
  const {
    writeContractAsync,
    data: hash,
    isPending,
    error,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createDeposit = async (params: {
    token: `0x${string}`;
    amountPerPeriod: bigint;
    periodSeconds: bigint;
    totalPeriods: number;
    discountLockupId?: bigint;
    value?: bigint; // For native token deposits
  }) => {
    if (!warehouseAddress)
      throw new Error("Warehouse not deployed on this chain");
    const txHash = await writeContractAsync({
      address: warehouseAddress,
      abi: warehouseAbi,
      functionName: "createDeposit",
      args: [
        params.token,
        params.amountPerPeriod,
        params.periodSeconds,
        params.totalPeriods,
        params.discountLockupId ?? 0n,
      ],
      value: params.value,
    });
    return txHash;
  };

  return { createDeposit, hash, isPending, isConfirming, isSuccess, error };
}

// Hook to create a coin-based lockup
export function useCreateLockup() {
  const warehouseAddress = useWarehouseAddress();
  const {
    writeContractAsync,
    data: hash,
    isPending,
    error,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createLockup = async (params: {
    token: `0x${string}`;
    amount: bigint;
    unlockTime: bigint;
    value?: bigint; // For native token lockups
  }) => {
    if (!warehouseAddress)
      throw new Error("Warehouse not deployed on this chain");
    const txHash = await writeContractAsync({
      address: warehouseAddress,
      abi: warehouseAbi,
      functionName: "createLockup",
      args: [params.token, params.amount, params.unlockTime],
      value: params.value,
    });
    return txHash;
  };

  return { createLockup, hash, isPending, isConfirming, isSuccess, error };
}

// Hook to withdraw from a deposit
export function useWithdraw() {
  const warehouseAddress = useWarehouseAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdraw = async (depositId: bigint) => {
    if (!warehouseAddress)
      throw new Error("Warehouse not deployed on this chain");
    return writeContract({
      address: warehouseAddress,
      abi: warehouseAbi,
      functionName: "withdraw",
      args: [depositId],
    });
  };

  return { withdraw, hash, isPending, isConfirming, isSuccess, error };
}

// Hook to withdraw from a lockup
export function useWithdrawLockup() {
  const warehouseAddress = useWarehouseAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdrawLockup = async (lockupId: bigint) => {
    if (!warehouseAddress)
      throw new Error("Warehouse not deployed on this chain");
    return writeContract({
      address: warehouseAddress,
      abi: warehouseAbi,
      functionName: "withdrawLockup",
      args: [lockupId],
    });
  };

  return { withdrawLockup, hash, isPending, isConfirming, isSuccess, error };
}

// Hook to emergency cancel a deposit
export function useEmergencyCancel() {
  const warehouseAddress = useWarehouseAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const emergencyCancel = async (depositId: bigint) => {
    if (!warehouseAddress)
      throw new Error("Warehouse not deployed on this chain");
    return writeContract({
      address: warehouseAddress,
      abi: warehouseAbi,
      functionName: "emergencyCancel",
      args: [depositId],
    });
  };

  return { emergencyCancel, hash, isPending, isConfirming, isSuccess, error };
}

// Hook to emergency cancel a lockup
export function useEmergencyCancelLockup() {
  const warehouseAddress = useWarehouseAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const emergencyCancelLockup = async (lockupId: bigint) => {
    if (!warehouseAddress)
      throw new Error("Warehouse not deployed on this chain");
    return writeContract({
      address: warehouseAddress,
      abi: warehouseAbi,
      functionName: "emergencyCancelLockup",
      args: [lockupId],
    });
  };

  return {
    emergencyCancelLockup,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// ============ Utility Functions ============

// Calculate fee based on periods
export function calculateFee(
  totalAmount: bigint,
  totalPeriods: number
): bigint {
  let feeRate: bigint;
  if (totalPeriods <= 10) {
    feeRate = 50n; // 0.5%
  } else if (totalPeriods <= 30) {
    feeRate = 80n; // 0.8%
  } else if (totalPeriods <= 100) {
    feeRate = 100n; // 1%
  } else {
    feeRate = 200n; // 2%
  }
  return (totalAmount * feeRate) / 10000n;
}

// Calculate lockup fee (0.5%)
export function calculateLockupFee(amount: bigint): bigint {
  return (amount * 5n) / 1000n;
}

// ============ Type Definitions ============

export interface DepositData {
  id: bigint;
  user: `0x${string}`;
  token: `0x${string}`;
  amountPerPeriod: bigint;
  periodSeconds: bigint;
  totalPeriods: number;
  periodsWithdrawn: number;
  nextWithdrawalTime: bigint;
}

export interface LockupData {
  id: bigint;
  user: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  unlockTime: bigint;
  withdrawn: boolean;
  isDiscountActive: boolean;
  createTime: bigint;
}

// Hook to read a single deposit with proper typing
export function useDepositById(depositId: bigint | undefined) {
  const warehouseAddress = useWarehouseAddress();
  const chainId = useContractChainId();

  return useReadContract({
    address: warehouseAddress,
    abi: warehouseAbi,
    functionName: "deposits",
    args: depositId !== undefined ? [depositId] : undefined,
    chainId,
    query: { enabled: depositId !== undefined && !!warehouseAddress },
  });
}

// Hook to read a single lockup with proper typing
export function useLockupById(lockupId: bigint | undefined) {
  const warehouseAddress = useWarehouseAddress();
  const chainId = useContractChainId();

  return useReadContract({
    address: warehouseAddress,
    abi: warehouseAbi,
    functionName: "lockups",
    args: lockupId !== undefined ? [lockupId] : undefined,
    chainId,
    query: { enabled: lockupId !== undefined && !!warehouseAddress },
  });
}

// Parse deposit tuple from contract
export function parseDeposit(
  id: bigint,
  data: readonly [string, string, bigint, bigint, number, number, bigint]
): DepositData {
  return {
    id,
    user: data[0] as `0x${string}`,
    token: data[1] as `0x${string}`,
    amountPerPeriod: data[2],
    periodSeconds: data[3],
    totalPeriods: data[4],
    periodsWithdrawn: data[5],
    nextWithdrawalTime: data[6],
  };
}

// Parse lockup tuple from contract
export function parseLockup(
  id: bigint,
  data: readonly [string, string, bigint, bigint, boolean, boolean, bigint]
): LockupData {
  return {
    id,
    user: data[0] as `0x${string}`,
    token: data[1] as `0x${string}`,
    amount: data[2],
    unlockTime: data[3],
    withdrawn: data[4],
    isDiscountActive: data[5],
    createTime: data[6],
  };
}

// ============ Blockchain Time Hook ============

import { useBlockNumber, useBlock } from "wagmi";

/**
 * 获取区块链当前时间（block.timestamp）
 * 严格按照链上时间计算，不使用本地时间
 * 注意：不使用 watch 避免频繁轮询，手动调用 refetch 来更新
 */
export function useBlockchainTime() {
  const chainId = useContractChainId();
  
  // 获取最新区块信息
  const { data: block, refetch, isLoading } = useBlock({
    chainId,
    query: {
      staleTime: 10000, // 10 秒内认为数据是新鲜的
    },
  });

  // 返回区块链时间（秒级 Unix 时间戳）
  const timestamp = block?.timestamp ? Number(block.timestamp) : undefined;

  return {
    timestamp,
    blockNumber: block?.number ? Number(block.number) : undefined,
    refetch,
    isLoading,
  };
}
