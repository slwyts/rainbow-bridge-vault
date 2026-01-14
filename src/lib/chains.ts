/**
 * 统一的多链配置文件
 * 所有链相关的配置都从这里导出，避免在多处重复定义
 */

import { hardhat, bsc, bscTestnet, arbitrum, xLayer, polygon } from "viem/chains";
import type { Chain as ViemChain } from "viem";

// ============ Chain IDs ============
export const CHAIN_IDS = {
  HARDHAT: 31337,
  XLAYER: 196,
  BSC_TESTNET: 97,
  BSC: 56,
  ARBITRUM: 42161,
  POLYGON: 137,
} as const;

export type SupportedChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

// ============ Trust Wallet Assets 映射 ============
export const CHAIN_TO_TRUST_WALLET: Record<string, string> = {
  localnet: "ethereum",
  "x-layer": "xlayer",
  "binance-smart-chain": "smartchain",
  "bsc-testnet": "smartchain",
  "arbitrum-one": "arbitrum",
  polygon: "polygon",
};

// ============ OKLink Chain ID 映射 (用于获取代币图标) ============
// OKLink CDN 格式: {chainId}-{contractAddress}-{tokenType}/type=default_90_0
// tokenType 107 覆盖面较广，作为默认值
const CHAIN_TO_OKLINK_ID: Record<string, number> = {
  localnet: 1, // Ethereum
  "x-layer": 196,
  "binance-smart-chain": 56,
  "bsc-testnet": 56,
  "arbitrum-one": 42161,
  polygon: 137,
};

// iconaves.com 链名映射
const CHAIN_TO_ICONAVES: Record<string, string> = {
  localnet: "eth",
  "x-layer": "xlayer",
  "binance-smart-chain": "bsc",
  "bsc-testnet": "bsc",
  "arbitrum-one": "arbitrum",
  polygon: "polygon",
};

// 特定代币的固定图标 URL（优先级最高）
// key 格式: {chainId}-{lowercaseAddress}
const FIXED_TOKEN_ICONS: Record<string, string> = {
  // X Layer USDG
  "x-layer-0x4ae46a509f6b1d9056937ba4500cb143933d2dc8":
    "https://static.oklink.com/cdn/web3/currency/token/large/196-0x4ae46a509f6b1d9056937ba4500cb143933d2dc8-107/type=default_90_0",
  // X Layer xWaifu
  "x-layer-0x140aba9691353ed54479372c4e9580d558d954b1":
    "https://static.oklink.com/cdn/web3/currency/token/large/196-0x140aba9691353ed54479372c4e9580d558d954b1-107/type=default_90_0",
};

// 获取特定代币的固定图标 URL
export function getFixedTokenIconUrl(
  contractAddress: string,
  chainId: string
): string | undefined {
  const key = `${chainId}-${contractAddress.toLowerCase()}`;
  return FIXED_TOKEN_ICONS[key];
}

// 获取 iconaves.com 代币图标 URL
// 格式: https://www.iconaves.com/token_icon/{chain}/{address}.png
export function getIconavesTokenIconUrl(
  contractAddress: string,
  chainId: string
): string | undefined {
  const iconavesChain = CHAIN_TO_ICONAVES[chainId];
  if (!iconavesChain) return undefined;
  return `https://www.iconaves.com/token_icon/${iconavesChain}/${contractAddress.toLowerCase()}.png`;
}

// 获取 Dyorswap 代币图标 URL (仅 X Layer)
// 格式: https://dyorswap.org/images/tokens/{checksumAddress}.png
export function getDyorswapTokenIconUrl(
  contractAddress: string,
  chainId: string
): string | undefined {
  if (chainId !== "x-layer") return undefined;
  // 使用 checksum address
  const { getAddress } = require("viem");
  try {
    const checksumAddress = getAddress(contractAddress);
    return `https://dyorswap.org/images/tokens/${checksumAddress}.png`;
  } catch {
    return undefined;
  }
}

// 获取 OKLink 代币图标 URL
export function getOKLinkTokenIconUrl(
  contractAddress: string,
  chainId: string,
  tokenType: number = 107
): string | undefined {
  const oklinkChainId = CHAIN_TO_OKLINK_ID[chainId];
  if (!oklinkChainId) return undefined;
  return `https://static.oklink.com/cdn/web3/currency/token/large/${oklinkChainId}-${contractAddress}-${tokenType}/type=default_90_0`;
}

// ============ 代币类型定义 ============
interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  isNative?: boolean;
  // 地址从环境变量读取，undefined表示未配置
  address?: `0x${string}`;
}

// ============ 链配置类型定义 ============
interface ChainConfig {
  // 基础信息
  chainId: number;
  stringId: string;
  name: string;
  shortName: string;

  // Viem chain 对象
  viemChain: ViemChain;

  // RPC URL
  rpcUrl: string;

  // 合约地址
  warehouseAddress?: `0x${string}`;

  // 代币配置
  tokens: {
    native: TokenConfig;
    USDT?: TokenConfig;
    USDC?: TokenConfig;
    USDG?: TokenConfig;
    XWAIFU?: TokenConfig;
  };

  // UI 相关
  gasEstimate: string;
  gasLevel: "low" | "medium" | "high";

  // Trust Wallet 图标名
  trustWalletName: string;
}

// ============ 从环境变量读取地址的辅助函数 ============
// 注意：Next.js 只在构建时替换字面量 process.env.XXX，不能用动态 key
function toAddress(value: string | undefined): `0x${string}` | undefined {
  if (value && value.startsWith("0x") && value.length === 42) {
    return value as `0x${string}`;
  }
  return undefined;
}

// 直接字面量访问环境变量，确保 Next.js 正确内联
const ENV_ADDRESSES = {
  // Localnet
  LOCALNET_WAREHOUSE: toAddress(
    process.env.NEXT_PUBLIC_LOCALNET_WAREHOUSE_ADDRESS
  ),
  LOCALNET_USDT: toAddress(process.env.NEXT_PUBLIC_LOCALNET_USDT_ADDRESS),
  LOCALNET_USDC: toAddress(process.env.NEXT_PUBLIC_LOCALNET_USDC_ADDRESS),
  LOCALNET_USDG: toAddress(process.env.NEXT_PUBLIC_LOCALNET_USDG_ADDRESS),
  LOCALNET_XWAIFU: toAddress(process.env.NEXT_PUBLIC_LOCALNET_XWAIFU_ADDRESS),
  // X Layer
  XLAYER_WAREHOUSE: toAddress(process.env.NEXT_PUBLIC_XLAYER_WAREHOUSE_ADDRESS),
  XLAYER_USDT: toAddress(process.env.NEXT_PUBLIC_XLAYER_USDT_ADDRESS),
  XLAYER_USDC: toAddress(process.env.NEXT_PUBLIC_XLAYER_USDC_ADDRESS),
  XLAYER_USDG: toAddress(process.env.NEXT_PUBLIC_XLAYER_USDG_ADDRESS),
  XLAYER_XWAIFU: toAddress(process.env.NEXT_PUBLIC_XLAYER_XWAIFU_ADDRESS),
  // BSC
  BSC_WAREHOUSE: toAddress(process.env.NEXT_PUBLIC_BSC_WAREHOUSE_ADDRESS),
  BSC_USDT: toAddress(process.env.NEXT_PUBLIC_BSC_USDT_ADDRESS),
  BSC_USDC: toAddress(process.env.NEXT_PUBLIC_BSC_USDC_ADDRESS),
  // BSC Testnet
  BSC_TESTNET_WAREHOUSE: toAddress(
    process.env.NEXT_PUBLIC_BSC_TESTNET_WAREHOUSE_ADDRESS
  ),
  BSC_TESTNET_USDT: toAddress(process.env.NEXT_PUBLIC_BSC_TESTNET_USDT_ADDRESS),
  BSC_TESTNET_USDC: toAddress(process.env.NEXT_PUBLIC_BSC_TESTNET_USDC_ADDRESS),
  // Arbitrum
  ARBITRUM_WAREHOUSE: toAddress(
    process.env.NEXT_PUBLIC_ARBITRUM_WAREHOUSE_ADDRESS
  ),
  ARBITRUM_USDT: toAddress(process.env.NEXT_PUBLIC_ARBITRUM_USDT_ADDRESS),
  ARBITRUM_USDC: toAddress(process.env.NEXT_PUBLIC_ARBITRUM_USDC_ADDRESS),
  // Polygon
  POLYGON_WAREHOUSE: toAddress(
    process.env.NEXT_PUBLIC_POLYGON_WAREHOUSE_ADDRESS
  ),
  POLYGON_USDT: toAddress(process.env.NEXT_PUBLIC_POLYGON_USDT_ADDRESS),
  POLYGON_USDC: toAddress(process.env.NEXT_PUBLIC_POLYGON_USDC_ADDRESS),
} as const;

// ============ 所有支持的链配置 ============
export const CHAIN_CONFIGS: Record<SupportedChainId, ChainConfig> = {
  // Hardhat / Localnet (开发环境)
  [CHAIN_IDS.HARDHAT]: {
    chainId: CHAIN_IDS.HARDHAT,
    stringId: "localnet",
    name: "Localnet",
    shortName: "Local",
    viemChain: hardhat,
    rpcUrl: "http://127.0.0.1:8545",
    warehouseAddress: ENV_ADDRESSES.LOCALNET_WAREHOUSE,
    tokens: {
      native: {
        symbol: "ETH",
        name: "Localnet ETH",
        decimals: 18,
        isNative: true,
      },
      USDT: {
        symbol: "USDT",
        name: "Mock USDT",
        decimals: 6,
        address: ENV_ADDRESSES.LOCALNET_USDT,
      },
      USDC: {
        symbol: "USDC",
        name: "Mock USDC",
        decimals: 6,
        address: ENV_ADDRESSES.LOCALNET_USDC,
      },
      USDG: {
        symbol: "USDG",
        name: "Mock USDG",
        decimals: 6,
        address: ENV_ADDRESSES.LOCALNET_USDG,
      },
      XWAIFU: {
        symbol: "xWaifu",
        name: "xWaifu Token",
        decimals: 18,
        address: ENV_ADDRESSES.LOCALNET_XWAIFU,
      },
    },
    gasEstimate: "<0.001",
    gasLevel: "low",
    trustWalletName: "ethereum",
  },

  // X Layer
  [CHAIN_IDS.XLAYER]: {
    chainId: CHAIN_IDS.XLAYER,
    stringId: "x-layer",
    name: "X Layer",
    shortName: "XLayer",
    viemChain: xLayer,
    rpcUrl: "https://rpc.xlayer.tech",
    warehouseAddress: ENV_ADDRESSES.XLAYER_WAREHOUSE,
    tokens: {
      native: { symbol: "OKB", name: "OKB", decimals: 18, isNative: true },
      USDT: {
        symbol: "USDT",
        name: "USDT",
        decimals: 6,
        address: ENV_ADDRESSES.XLAYER_USDT,
      },
      USDC: {
        symbol: "USDC",
        name: "USDC",
        decimals: 6,
        address: ENV_ADDRESSES.XLAYER_USDC,
      },
      USDG: {
        symbol: "USDG",
        name: "USDG",
        decimals: 6,
        address: ENV_ADDRESSES.XLAYER_USDG,
      },
      XWAIFU: {
        symbol: "xWaifu",
        name: "xWaifu",
        decimals: 18,
        address: ENV_ADDRESSES.XLAYER_XWAIFU,
      },
    },
    gasEstimate: "$0.001",
    gasLevel: "low",
    trustWalletName: "xlayer",
  },

  // BSC Mainnet
  [CHAIN_IDS.BSC]: {
    chainId: CHAIN_IDS.BSC,
    stringId: "binance-smart-chain",
    name: "BNB Smart Chain",
    shortName: "BSC",
    viemChain: bsc,
    rpcUrl: "https://bsc-dataseed.binance.org",
    warehouseAddress: ENV_ADDRESSES.BSC_WAREHOUSE,
    tokens: {
      native: { symbol: "BNB", name: "BNB", decimals: 18, isNative: true },
      USDT: {
        symbol: "USDT",
        name: "USDT",
        decimals: 18, // BSC USDT is 18 decimals
        address: ENV_ADDRESSES.BSC_USDT,
      },
      USDC: {
        symbol: "USDC",
        name: "USDC",
        decimals: 18,
        address: ENV_ADDRESSES.BSC_USDC,
      },
    },
    gasEstimate: "$0.05",
    gasLevel: "low",
    trustWalletName: "smartchain",
  },

  // BSC Testnet
  [CHAIN_IDS.BSC_TESTNET]: {
    chainId: CHAIN_IDS.BSC_TESTNET,
    stringId: "bsc-testnet",
    name: "BSC Testnet",
    shortName: "tBSC",
    viemChain: bscTestnet,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    warehouseAddress: ENV_ADDRESSES.BSC_TESTNET_WAREHOUSE,
    tokens: {
      native: {
        symbol: "tBNB",
        name: "Test BNB",
        decimals: 18,
        isNative: true,
      },
      USDT: {
        symbol: "USDT",
        name: "Test USDT",
        decimals: 18,
        address: ENV_ADDRESSES.BSC_TESTNET_USDT,
      },
      USDC: {
        symbol: "USDC",
        name: "Test USDC",
        decimals: 18,
        address: ENV_ADDRESSES.BSC_TESTNET_USDC,
      },
    },
    gasEstimate: "<0.001",
    gasLevel: "low",
    trustWalletName: "smartchain",
  },

  // Arbitrum
  [CHAIN_IDS.ARBITRUM]: {
    chainId: CHAIN_IDS.ARBITRUM,
    stringId: "arbitrum-one",
    name: "Arbitrum One",
    shortName: "Arb",
    viemChain: arbitrum,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    warehouseAddress: ENV_ADDRESSES.ARBITRUM_WAREHOUSE,
    tokens: {
      native: { symbol: "ETH", name: "Ethereum", decimals: 18, isNative: true },
      USDT: {
        symbol: "USDT",
        name: "USDT",
        decimals: 6,
        address: ENV_ADDRESSES.ARBITRUM_USDT,
      },
      USDC: {
        symbol: "USDC",
        name: "USDC",
        decimals: 6,
        address: ENV_ADDRESSES.ARBITRUM_USDC,
      },
    },
    gasEstimate: "$0.10",
    gasLevel: "medium",
    trustWalletName: "arbitrum",
  },

  // Polygon
  [CHAIN_IDS.POLYGON]: {
    chainId: CHAIN_IDS.POLYGON,
    stringId: "polygon",
    name: "Polygon",
    shortName: "Polygon",
    viemChain: polygon,
    rpcUrl: "https://polygon-rpc.com",
    warehouseAddress: ENV_ADDRESSES.POLYGON_WAREHOUSE,
    tokens: {
      native: { symbol: "POL", name: "POL", decimals: 18, isNative: true },
      USDT: {
        symbol: "USDT",
        name: "USDT",
        decimals: 6,
        address: ENV_ADDRESSES.POLYGON_USDT,
      },
      USDC: {
        symbol: "USDC",
        name: "USDC",
        decimals: 6,
        address: ENV_ADDRESSES.POLYGON_USDC,
      },
    },
    gasEstimate: "$0.01",
    gasLevel: "low",
    trustWalletName: "polygon",
  },
};

// ============ 辅助函数 ============

/**
 * 获取所有启用的链ID（配置了仓库地址的链）
 * 这是主要使用的函数，UI组件应该使用这个
 */
export function getAllChainIds(): SupportedChainId[] {
  return (Object.keys(CHAIN_CONFIGS).map(Number) as SupportedChainId[]).filter(
    (id) => CHAIN_CONFIGS[id].warehouseAddress
  );
}

/**
 * 获取链的字符串ID
 */
export function getChainStringId(chainId: number): string {
  return CHAIN_CONFIGS[chainId as SupportedChainId]?.stringId || "unknown";
}

/**
 * 获取链的数字ID（从字符串ID）
 */
export function getChainNumericId(stringId: string): number {
  const config = Object.values(CHAIN_CONFIGS).find((c) => c.stringId === stringId);
  return config?.chainId || CHAIN_IDS.HARDHAT;
}

/**
 * 获取链名称
 */
export function getChainName(chainId: number): string {
  return CHAIN_CONFIGS[chainId as SupportedChainId]?.name || `Chain ${chainId}`;
}

/**
 * 获取仓库合约地址
 */
export function getWarehouseAddress(
  chainId: number
): `0x${string}` | undefined {
  return CHAIN_CONFIGS[chainId as SupportedChainId]?.warehouseAddress;
}

/**
 * 获取代币地址
 */
export function getTokenAddress(
  chainId: number,
  symbol: "USDT" | "USDC" | "USDG" | "XWAIFU"
): `0x${string}` | undefined {
  return CHAIN_CONFIGS[chainId as SupportedChainId]?.tokens[symbol]?.address;
}

/**
 * 获取原生代币符号
 */
export function getNativeTokenSymbol(chainId: number): string {
  return (
    CHAIN_CONFIGS[chainId as SupportedChainId]?.tokens.native.symbol || "ETH"
  );
}

/**
 * 获取区块链浏览器 URL
 */
export function getBlockExplorerUrl(chainId: number): string | undefined {
  const config = CHAIN_CONFIGS[chainId as SupportedChainId];
  return config?.viemChain.blockExplorers?.default.url;
}

/**
 * 获取合约代码页面 URL
 */
export function getContractCodeUrl(
  chainId: number,
  contractAddress: string
): string | undefined {
  const explorerUrl = getBlockExplorerUrl(chainId);
  if (!explorerUrl) return undefined;
  return `${explorerUrl}/address/${contractAddress}#code`;
}

// ============ UI 代币类型 ============

/**
 * UI 代币类型定义（用于资产选择器等组件）
 */
export interface Currency {
  id: string;
  name: string;
  symbol: string;
  iconUrl?: string;
  contractAddress?: string;
  isCustom?: boolean;
  chainId?: string;
  decimals?: number;
  isNative?: boolean;
}

/**
 * 获取链上代币列表（Currency 格式，用于 UI 组件）
 */
export function getCurrenciesForChain(chainId: number): Currency[] {
  const config = CHAIN_CONFIGS[chainId as SupportedChainId];
  if (!config) {
    // Fallback to generic tokens
    return [
      {
        id: "ETH",
        name: "Ethereum",
        symbol: "ETH",
        isNative: true,
        decimals: 18,
      },
      { id: "USDT", name: "Tether", symbol: "USDT", decimals: 6 },
      { id: "USDC", name: "USD Coin", symbol: "USDC", decimals: 6 },
    ];
  }

  const currencies: Currency[] = [];
  const stringId = config.stringId;

  // 添加原生代币
  currencies.push({
    id: `${stringId}-${config.tokens.native.symbol.toLowerCase()}`,
    name: config.tokens.native.name,
    symbol: config.tokens.native.symbol,
    isNative: true,
    decimals: config.tokens.native.decimals,
    chainId: stringId,
  });

  // 添加其他代币
  const tokenKeys = ["USDT", "USDC", "USDG", "XWAIFU"] as const;
  for (const key of tokenKeys) {
    const token = config.tokens[key];
    if (token?.address) {
      currencies.push({
        id: `${stringId}-${token.symbol.toLowerCase()}`,
        name: token.name,
        symbol: token.symbol,
        contractAddress: token.address,
        decimals: token.decimals,
        chainId: stringId,
      });
    }
  }

  return currencies;
}

// ============ 默认值 ============
const DEFAULT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || CHAIN_IDS.HARDHAT
) as SupportedChainId;

/**
 * 获取支持 xWAIFU VIP 的链ID列表
 * 只返回配置了 xWAIFU 代币地址的链
 */
export function getXWaifuSupportedChainIds(): SupportedChainId[] {
  return getAllChainIds().filter(
    (id) => CHAIN_CONFIGS[id].tokens.XWAIFU?.address
  );
}

/**
 * 获取首选的 xWAIFU 链
 * 优先级：当前链 > 默认链 > 第一个支持的链
 */
export function getPreferredXWaifuChainId(
  currentChainId?: number
): SupportedChainId | undefined {
  const supportedChains = getXWaifuSupportedChainIds();
  if (supportedChains.length === 0) return undefined;

  // 优先使用当前链（如果它支持 xWAIFU）
  if (
    currentChainId &&
    supportedChains.includes(currentChainId as SupportedChainId)
  ) {
    return currentChainId as SupportedChainId;
  }

  // 其次使用默认链（如果它支持 xWAIFU）
  if (supportedChains.includes(DEFAULT_CHAIN_ID)) {
    return DEFAULT_CHAIN_ID;
  }

  // 最后返回第一个支持的链
  return supportedChains[0];
}
