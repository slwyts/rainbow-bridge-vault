// Supported chain IDs
export const CHAIN_IDS = {
  HARDHAT: 31337,
  XLAYER: 196,
  BSC: 56,
  ARBITRUM: 42161,
} as const;

export type SupportedChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];

// Chain configuration type
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

// Per-chain configurations from environment variables
const chainConfigs: Record<number, ChainConfig> = {
  // Hardhat / Localnet
  [CHAIN_IDS.HARDHAT]: {
    chainId: CHAIN_IDS.HARDHAT,
    name: 'Localnet',
    warehouseAddress: process.env.NEXT_PUBLIC_LOCALNET_WAREHOUSE_ADDRESS as `0x${string}`,
    tokens: {
      USDT: process.env.NEXT_PUBLIC_LOCALNET_USDT_ADDRESS as `0x${string}`,
      USDC: process.env.NEXT_PUBLIC_LOCALNET_USDC_ADDRESS as `0x${string}`,
      XWAIFU: process.env.NEXT_PUBLIC_LOCALNET_XWAIFU_ADDRESS as `0x${string}`,
    },
  },
  // X Layer
  [CHAIN_IDS.XLAYER]: {
    chainId: CHAIN_IDS.XLAYER,
    name: 'X Layer',
    warehouseAddress: process.env.NEXT_PUBLIC_XLAYER_WAREHOUSE_ADDRESS as `0x${string}`,
    tokens: {
      USDT: process.env.NEXT_PUBLIC_XLAYER_USDT_ADDRESS as `0x${string}`,
      USDC: process.env.NEXT_PUBLIC_XLAYER_USDC_ADDRESS as `0x${string}`,
    },
  },
  // BSC
  [CHAIN_IDS.BSC]: {
    chainId: CHAIN_IDS.BSC,
    name: 'BSC',
    warehouseAddress: process.env.NEXT_PUBLIC_BSC_WAREHOUSE_ADDRESS as `0x${string}`,
    tokens: {
      USDT: process.env.NEXT_PUBLIC_BSC_USDT_ADDRESS as `0x${string}`,
      USDC: process.env.NEXT_PUBLIC_BSC_USDC_ADDRESS as `0x${string}`,
    },
  },
  // Arbitrum
  [CHAIN_IDS.ARBITRUM]: {
    chainId: CHAIN_IDS.ARBITRUM,
    name: 'Arbitrum',
    warehouseAddress: process.env.NEXT_PUBLIC_ARB_WAREHOUSE_ADDRESS as `0x${string}`,
    tokens: {
      USDT: process.env.NEXT_PUBLIC_ARB_USDT_ADDRESS as `0x${string}`,
      USDC: process.env.NEXT_PUBLIC_ARB_USDC_ADDRESS as `0x${string}`,
    },
  },
};

// Get config for a specific chain
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return chainConfigs[chainId];
}

// Get warehouse address for a chain
export function getWarehouseAddress(chainId: number): `0x${string}` | undefined {
  return chainConfigs[chainId]?.warehouseAddress;
}

// Get token address for a chain
export function getTokenAddress(chainId: number, symbol: 'USDT' | 'USDC' | 'XWAIFU'): `0x${string}` | undefined {
  return chainConfigs[chainId]?.tokens[symbol];
}

// Get all supported chain IDs that have warehouse configured
export function getSupportedChainIds(): number[] {
  return Object.values(chainConfigs)
    .filter(config => config.warehouseAddress)
    .map(config => config.chainId);
}

// Get chain name
export function getChainName(chainId: number): string {
  return chainConfigs[chainId]?.name || `Chain ${chainId}`;
}

// Default chain ID (for development)
export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || CHAIN_IDS.HARDHAT);

// Legacy ENV export for backward compatibility (will be removed)
export const ENV = {
  LOCALNET_WAREHOUSE_ADDRESS: process.env.NEXT_PUBLIC_LOCALNET_WAREHOUSE_ADDRESS as `0x${string}`,
  LOCALNET_USDT_ADDRESS: process.env.NEXT_PUBLIC_LOCALNET_USDT_ADDRESS as `0x${string}`,
  LOCALNET_USDC_ADDRESS: process.env.NEXT_PUBLIC_LOCALNET_USDC_ADDRESS as `0x${string}`,
  LOCALNET_XWAIFU_ADDRESS: process.env.NEXT_PUBLIC_LOCALNET_XWAIFU_ADDRESS as `0x${string}`,
  LOCAL_CHAIN_ID: Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 31337),
} as const;

// Helper to check if we are missing any required env vars
export function checkEnv() {
  const missing = Object.entries(ENV).filter(([key, value]) => !value && key !== 'LOCAL_CHAIN_ID');
  if (missing.length > 0) {
    console.warn('Missing environment variables:', missing.map(([key]) => key).join(', '));
  }
}
