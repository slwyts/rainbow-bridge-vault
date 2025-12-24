#!/usr/bin/env node

/**
 * 时间跳跃脚本 - 通过 RPC 调用调整 Hardhat 区块链时间
 * 用于测试需要时间流逝的功能（如锁仓、收益等）
 *
 * 使用方式:
 *   node scripts/time-jump.js 7      # 跳跃 7 天
 *   npm run time 7                   # 同上
 */

const RPC_URL = "http://127.0.0.1:8545";

async function rpcCall(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: 1,
    }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.result;
}

async function getBlockInfo() {
  const block = await rpcCall("eth_getBlockByNumber", ["latest", false]);
  const blockNumber = parseInt(block.number, 16);
  const timestamp = parseInt(block.timestamp, 16);
  return { blockNumber, timestamp };
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function main() {
  const days = parseInt(process.argv[2]);

  if (!days || isNaN(days) || days <= 0) {
    console.log("❌ 请指定要跳跃的天数");
    console.log("");
    console.log("用法: node scripts/time-jump.js <天数>");
    console.log("例子: node scripts/time-jump.js 7   # 跳跃 7 天");
    console.log("      npm run time 7                # 同上");
    process.exit(1);
  }

  const seconds = days * 24 * 60 * 60;

  console.log(`⏰ 时间跳跃 ${days} 天 (${seconds.toLocaleString()} 秒)...`);
  console.log("");

  // 检查节点是否运行
  try {
    await rpcCall("eth_blockNumber");
  } catch (error) {
    console.log("❌ Hardhat 节点未运行");
    console.log("请先运行: npm run node");
    process.exit(1);
  }

  // 获取当前状态
  const before = await getBlockInfo();
  console.log("📊 当前状态:");
  console.log(`   区块: ${before.blockNumber}`);
  console.log(`   时间: ${formatDate(before.timestamp)}`);
  console.log("");

  // 增加时间
  console.log("🚀 执行时间跳跃...");
  await rpcCall("evm_increaseTime", [seconds]);

  // 挖一个新块让时间生效
  await rpcCall("evm_mine");

  // 获取新状态
  const after = await getBlockInfo();
  console.log("");
  console.log("✅ 时间跳跃完成!");
  console.log("📊 新状态:");
  console.log(`   区块: ${after.blockNumber}`);
  console.log(`   时间: ${formatDate(after.timestamp)}`);
  console.log(`   跳跃: ${days} 天`);
}

main().catch((error) => {
  console.error("❌ 错误:", error.message);
  process.exit(1);
});
