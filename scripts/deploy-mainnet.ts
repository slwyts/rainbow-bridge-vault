#!/usr/bin/env npx ts-node

/**
 * Mainnet Deployment Script for RainbowWarehouse
 *
 * Usage:
 *   npm run deploy <network> <owner_address>
 *
 * Examples:
 *   npm run deploy xlayer 0x98c2e0ecdfa961f8b36144c743fea3951dad0309
 *   npm run deploy bsc 0x98c2e0ecdfa961f8b36144c743fea3951dad0309
 *
 * Supported Networks:
 *   - xlayer, bsc, arbitrum, ethereum, polygon, base, bscTestnet
 */

import hre from "hardhat";
import "@nomicfoundation/hardhat-toolbox-viem";

const SUPPORTED_NETWORKS: Record<string, { chainId: number; name: string }> = {
  xlayer: { chainId: 196, name: "X Layer" },
  bsc: { chainId: 56, name: "BNB Smart Chain" },
  arbitrum: { chainId: 42161, name: "Arbitrum One" },
  ethereum: { chainId: 1, name: "Ethereum Mainnet" },
  polygon: { chainId: 137, name: "Polygon" },
  base: { chainId: 8453, name: "Base" },
  bscTestnet: { chainId: 97, name: "BSC Testnet" },
};

function showUsage() {
  console.log("\nUsage: npm run deploy <network> <owner_address>\n");
  console.log("Supported networks:");
  for (const [key, val] of Object.entries(SUPPORTED_NETWORKS)) {
    console.log(`  ${key.padEnd(12)} - ${val.name} (Chain ID: ${val.chainId})`);
  }
  console.log("\nExample:");
  console.log("  npm run deploy xlayer 0x98c2e0ecdfa961f8b36144c743fea3951dad0309\n");
}

async function main() {
  // 从环境变量获取参数（由 package.json script 传入）
  const ownerAddress = process.env.DEPLOY_OWNER;

  if (!ownerAddress) {
    console.error("Error: Owner address is required!");
    showUsage();
    process.exit(1);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
    console.error("Error: Invalid owner address format!");
    process.exit(1);
  }

  // Try to access viem from hre or network connection
  let viem = (hre as any).viem;

  if (!viem && hre.network && (hre.network as any).connect) {
    console.log("Connecting to network...");
    const connection = await (hre.network as any).connect();
    viem = connection.viem;
  }

  if (!viem) {
    console.error("Error: viem not found on hre");
    process.exit(1);
  }

  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  const networkInfo = Object.values(SUPPORTED_NETWORKS).find(n => n.chainId === chainId);

  console.log("=".repeat(60));
  console.log("RainbowWarehouse Deployment");
  console.log("=".repeat(60));
  console.log(`Network:  ${networkInfo?.name || "Unknown"} (Chain ID: ${chainId})`);
  console.log(`Deployer: ${deployer.account.address}`);
  console.log(`Owner:    ${ownerAddress}`);

  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Balance:  ${(Number(balance) / 1e18).toFixed(6)} native tokens`);

  if (balance === 0n) {
    console.error("\nError: Deployer has no balance!");
    process.exit(1);
  }

  console.log("-".repeat(60));
  console.log("Deploying RainbowWarehouse...");

  const warehouse = await viem.deployContract("RainbowWarehouse", [
    ownerAddress,
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
  ]);

  console.log("-".repeat(60));
  console.log("Deployment Successful!");
  console.log(`Contract: ${warehouse.address}`);
  console.log("=".repeat(60));

  // 输出环境变量
  const prefix = networkInfo ? Object.entries(SUPPORTED_NETWORKS).find(([, v]) => v.chainId === chainId)?.[0]?.toUpperCase() : "UNKNOWN";
  console.log(`\nNEXT_PUBLIC_${prefix}_WAREHOUSE_ADDRESS=${warehouse.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Deployment failed:", e);
    process.exit(1);
  });
