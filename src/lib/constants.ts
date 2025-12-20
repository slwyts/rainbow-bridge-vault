/**
 * @deprecated 请直接从 '@/lib/chains' 导入
 * 此文件保留用于向后兼容，所有新代码应直接使用 chains.ts
 */

// 从统一配置重新导出
export {
  CHAIN_IDS,
  type SupportedChainId,
  getChainConfig,
  getWarehouseAddress,
  getTokenAddress,
  getChainName,
  getActiveChainIds as getSupportedChainIds,
  DEFAULT_CHAIN_ID,
} from "./chains";

// 旧版 ChainConfig 接口（向后兼容）
export interface ChainConfig {
  chainId: number;
  name: string;
  warehouseAddress: `0x${string}` | undefined;
  tokens: {
    USDT?: `0x${string}`;
    USDC?: `0x${string}`;
    XWAIFU?: `0x${string}`;
  };
}

// Legacy ENV export（向后兼容，将被移除）
// @deprecated 使用 chains.ts 中的函数替代
import { CHAIN_IDS, getTokenAddress as getToken } from "./chains";

export const ENV = {
  LOCALNET_WAREHOUSE_ADDRESS: process.env
    .NEXT_PUBLIC_LOCALNET_WAREHOUSE_ADDRESS as `0x${string}`,
  LOCALNET_USDT_ADDRESS: getToken(CHAIN_IDS.HARDHAT, "USDT"),
  LOCALNET_USDC_ADDRESS: getToken(CHAIN_IDS.HARDHAT, "USDC"),
  LOCALNET_XWAIFU_ADDRESS: getToken(CHAIN_IDS.HARDHAT, "XWAIFU"),
  LOCAL_CHAIN_ID: CHAIN_IDS.HARDHAT,
} as const;

// Helper to check if we are missing any required env vars
export function checkEnv() {
  const missing = Object.entries(ENV).filter(
    ([key, value]) => !value && key !== "LOCAL_CHAIN_ID"
  );
  if (missing.length > 0) {
    console.warn(
      "Missing environment variables:",
      missing.map(([key]) => key).join(", ")
    );
  }
}
