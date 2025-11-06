/**
 * 测试辅助工具和常量
 */

// 链配置
const CHAIN_CONFIG = {
  BSC: {
    chainId: 56,
    rpcUrl: "https://bsc-dataseed.binance.org/",
    usdt: "0x55d398326f99059fF775485246999027B3197955",
    usdtDecimals: 18,
    usdtWhale: "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3", // Binance hot wallet
    minAmount: "5000000000000000000", // 5 USDT (18位)
    protocolFee: "10000000000000000", // 0.01 USDT (18位)
  },
  XLAYER: {
    chainId: 196,
    rpcUrl: "https://rpc.xlayer.tech",
    usdt: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    xwaifu: "0x140abA9691353eD54479372c4E9580D558D954b1",
    usdtDecimals: 6,
    minAmount: "5000000", // 5 USDT (6位)
    protocolFee: "10000", // 0.01 USDT (6位)
    // 注意: whale地址需要根据实际情况更新
    usdtWhale: "0x1234567890123456789012345678901234567890",
    xwaifuWhale: "0x1234567890123456789012345678901234567890",
  }
};

// 常量
const CONSTANTS = {
  MAX_PERIODS: 365,
  XWAIFU_DISCOUNT_COST: "100000000000000000000", // 100 xwaifu (18位)
  XWAIFU_STAKE_REQUIREMENT: "10000000000000000000000", // 10000 xwaifu (18位)
  XWAIFU_STAKE_DURATION: 365 * 24 * 60 * 60, // 365天 (秒)
  
  // 时间常量
  ONE_HOUR: 3600,
  ONE_DAY: 86400,
  ONE_WEEK: 604800,
  THIRTY_DAYS: 2592000,
  ONE_YEAR: 31536000,
};

// 费率配置 (基点, 1基点 = 0.01%)
const FEE_RATES = {
  PERIODS_1_10: 50,    // 0.5%
  PERIODS_11_30: 80,   // 0.8%
  PERIODS_31_100: 100, // 1.0%
  PERIODS_101_365: 200, // 2.0%
  TOKEN_LOCKUP: 5,     // 0.005 = 0.5%
};

/**
 * 计算基础费用
 * @param {BigInt} totalAmount - 总金额
 * @param {number} periods - 期数
 * @returns {BigInt} - 基础费用
 */
function calculateBaseFee(totalAmount, periods) {
  let feeBps;
  
  if (periods <= 10) {
    feeBps = FEE_RATES.PERIODS_1_10;
  } else if (periods <= 30) {
    feeBps = FEE_RATES.PERIODS_11_30;
  } else if (periods <= 100) {
    feeBps = FEE_RATES.PERIODS_31_100;
  } else {
    feeBps = FEE_RATES.PERIODS_101_365;
  }
  
  return (totalAmount * BigInt(feeBps)) / 10000n;
}

/**
 * 计算总费用 (基础费用 + 协议费用)
 * @param {BigInt} totalAmount - 总金额
 * @param {number} periods - 期数
 * @param {BigInt} protocolFeePerPeriod - 单期协议费用
 * @param {boolean} useDiscount - 是否使用优惠 (基础费用半价)
 * @returns {Object} - { baseFee, protocolFee, totalFee }
 */
function calculateTotalFee(totalAmount, periods, protocolFeePerPeriod, useDiscount = false) {
  let baseFee = calculateBaseFee(totalAmount, periods);
  
  if (useDiscount) {
    baseFee = baseFee / 2n;
  }
  
  const protocolFee = protocolFeePerPeriod * BigInt(periods);
  const totalFee = baseFee + protocolFee;
  
  return { baseFee, protocolFee, totalFee };
}

/**
 * 计算代币锁仓费用 (0.5%)
 * @param {BigInt} amount - 锁仓金额
 * @returns {Object} - { fee, amountToLock }
 */
function calculateLockupFee(amount) {
  const fee = (amount * BigInt(FEE_RATES.TOKEN_LOCKUP)) / 1000n;
  const amountToLock = amount - fee;
  
  return { fee, amountToLock };
}

/**
 * 格式化金额显示
 * @param {BigInt} amount - 金额
 * @param {number} decimals - 精度
 * @returns {string} - 格式化后的金额
 */
function formatAmount(amount, decimals) {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  return `${integerPart}.${fractionalPart.toString().padStart(decimals, '0')}`;
}

/**
 * 解析金额字符串为BigInt
 * @param {string} amountStr - 金额字符串 (如 "100.5")
 * @param {number} decimals - 精度
 * @returns {BigInt} - BigInt金额
 */
function parseAmount(amountStr, decimals) {
  const [integerPart, fractionalPart = ""] = amountStr.split(".");
  const paddedFractional = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  const amountString = integerPart + paddedFractional;
  
  return BigInt(amountString);
}

/**
 * 获取当前链配置
 * @param {number} chainId - 链ID
 * @returns {Object} - 链配置
 */
function getChainConfig(chainId) {
  if (chainId === 56 || chainId === 56n) {
    return CHAIN_CONFIG.BSC;
  } else if (chainId === 196 || chainId === 196n) {
    return CHAIN_CONFIG.XLAYER;
  }
  throw new Error(`Unsupported chain ID: ${chainId}`);
}

/**
 * 创建测试用的存款参数
 * @param {Object} options - 选项
 * @returns {Object} - 存款参数
 */
function createDepositParams(options = {}) {
  const {
    amountPerPeriod = "100",
    periodSeconds = CONSTANTS.ONE_DAY,
    totalPeriods = 10,
    decimals = 18,
    useDiscount = false,
  } = options;
  
  const amountPerPeriodBN = parseAmount(amountPerPeriod, decimals);
  const totalAmount = amountPerPeriodBN * BigInt(totalPeriods);
  const protocolFeePerPeriod = decimals === 18 
    ? BigInt(CHAIN_CONFIG.BSC.protocolFee)
    : BigInt(CHAIN_CONFIG.XLAYER.protocolFee);
  
  const fees = calculateTotalFee(totalAmount, totalPeriods, protocolFeePerPeriod, useDiscount);
  const totalToTransfer = totalAmount + fees.totalFee;
  
  return {
    amountPerPeriod: amountPerPeriodBN,
    periodSeconds,
    totalPeriods,
    totalAmount,
    ...fees,
    totalToTransfer,
  };
}

/**
 * 创建测试用的锁仓参数
 * @param {Object} options - 选项
 * @returns {Object} - 锁仓参数
 */
function createLockupParams(options = {}) {
  const {
    amount = "1000",
    unlockTime = null,
    decimals = 18,
    durationDays = 30,
  } = options;
  
  const amountBN = parseAmount(amount, decimals);
  const { fee, amountToLock } = calculateLockupFee(amountBN);
  const unlockTimestamp = unlockTime || (Math.floor(Date.now() / 1000) + durationDays * CONSTANTS.ONE_DAY);
  
  return {
    amount: amountBN,
    unlockTime: unlockTimestamp,
    fee,
    amountToLock,
  };
}

/**
 * 验证链配置
 * @param {Object} warehouse - 合约实例
 * @param {number} expectedChainId - 预期链ID
 */
async function verifyChainConfig(warehouse, expectedChainId) {
  const config = getChainConfig(expectedChainId);
  const stablecoin = await warehouse.stablecoin();
  const stablecoinDecimals = await warehouse.stablecoinDecimals();
  const minAmount = await warehouse.MIN_AMOUNT_PER_PERIOD_SCALED();
  const protocolFee = await warehouse.protocolFeePerPeriod();
  
  return {
    stablecoin: stablecoin.toLowerCase() === config.usdt.toLowerCase(),
    decimals: stablecoinDecimals === config.usdtDecimals,
    minAmount: minAmount.toString() === config.minAmount,
    protocolFee: protocolFee.toString() === config.protocolFee,
  };
}

/**
 * 等待多个区块
 * @param {number} blocks - 区块数
 */
async function mineBlocks(blocks) {
  const { ethers } = require("hardhat");
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}

/**
 * 获取最新区块时间戳
 */
async function getLatestTimestamp() {
  const { ethers } = require("hardhat");
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

module.exports = {
  CHAIN_CONFIG,
  CONSTANTS,
  FEE_RATES,
  calculateBaseFee,
  calculateTotalFee,
  calculateLockupFee,
  formatAmount,
  parseAmount,
  getChainConfig,
  createDepositParams,
  createLockupParams,
  verifyChainConfig,
  mineBlocks,
  getLatestTimestamp,
};
