#!/usr/bin/env node

/**
 * Deploy wrapper - passes arguments to hardhat
 * Usage: npm run deploy <network> <owner>
 */

const { execSync } = require("child_process");

const args = process.argv.slice(2);
const network = args[0];
const owner = args[1];

if (!network || !owner) {
  console.log("Usage: npm run deploy <network> <owner>");
  console.log("Example: npm run deploy xlayer 0x7383a08989bfe10a8b59b1529a2a48d46f3ef006");
  console.log("\nSupported networks: xlayer, bsc, arbitrum, ethereum, polygon, base, bscTestnet");
  process.exit(1);
}

if (!/^0x[a-fA-F0-9]{40}$/.test(owner)) {
  console.log("Error: Invalid owner address format!");
  process.exit(1);
}

try {
  execSync(`npx hardhat run scripts/deploy-mainnet.ts --network ${network}`, {
    stdio: "inherit",
    env: { ...process.env, DEPLOY_OWNER: owner },
  });
} catch (e) {
  process.exit(1);
}
