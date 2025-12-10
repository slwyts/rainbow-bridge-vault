import { parseEther, parseUnits } from "viem";
import hre from "hardhat";
import fs from "fs";
import path from "path";
import "@nomicfoundation/hardhat-toolbox-viem";

async function main() {
  // Try to access viem from network object if not on HRE
  let viem = (hre as any).viem;
  
  if (!viem && hre.network && (hre.network as any).connect) {
      console.log("Connecting to network...");
      const connection = await (hre.network as any).connect();
      viem = connection.viem;
  }
  
  if (!viem) {
    console.error("Error: 'viem' object not found on 'hre' or network connection.");
    process.exit(1);
  }

  const [deployer] = await viem.getWalletClients();

  console.log("Deploying contracts with the account:", deployer.account.address);

  // Target Addresses
  const ownerAddress = "0x98c2e0ecdfa961f8b36144c743fea3951dad0309";
  const user2Address = "0xa4b76d7cae384c9a5fd5f573cef74bfdb980e966";

  // 1. Deploy Mocks
  console.log("Deploying Mock Tokens...");
  
  const usdt = await viem.deployContract("MockERC20", ["Tether USD", "USDT", 6]);
  console.log("USDT deployed to:", usdt.address);

  const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
  console.log("USDC deployed to:", usdc.address);

  const xwaifu = await viem.deployContract("MockERC20", ["xWaifu", "xWAIFU", 18]);
  console.log("xWaifu deployed to:", xwaifu.address);

  // 2. Deploy Warehouse
  console.log("Deploying RainbowWarehouse...");
  // Pass ownerAddress as the initial owner
  const warehouse = await viem.deployContract("RainbowWarehouse", [
    ownerAddress, 
    xwaifu.address
  ]);
  console.log("RainbowWarehouse deployed to:", warehouse.address);

  // 3. Mint Tokens & Send ETH
  const tokens = [
    { contract: usdt, name: "USDT", decimals: 6, amount: "100000" },
    { contract: usdc, name: "USDC", decimals: 6, amount: "100000" },
    { contract: xwaifu, name: "xWaifu", decimals: 18, amount: "100000" },
  ];

  const recipients = [ownerAddress, user2Address];

  for (const recipient of recipients) {
    console.log(`Processing recipient: ${recipient}`);
    
    // Send ETH
    await deployer.sendTransaction({
      to: recipient as `0x${string}`,
      value: parseEther("100"),
    });
    console.log(`  Sent 100 ETH`);

    // Mint Tokens
    for (const token of tokens) {
      const amount = parseUnits(token.amount, token.decimals);
      await token.contract.write.mint([recipient as `0x${string}`, amount]);
      console.log(`  Minted ${token.amount} ${token.name}`);
    }
  }

  // 4. Generate .env.local
  const envContent = `NEXT_PUBLIC_LOCALNET_WAREHOUSE_ADDRESS=${warehouse.address}
NEXT_PUBLIC_LOCALNET_USDT_ADDRESS=${usdt.address}
NEXT_PUBLIC_LOCALNET_USDC_ADDRESS=${usdc.address}
NEXT_PUBLIC_LOCALNET_XWAIFU_ADDRESS=${xwaifu.address}
NEXT_PUBLIC_LOCAL_CHAIN_ID=31337`;

  const envPath = path.join(process.cwd(), "../.env.local");
  fs.writeFileSync(envPath, envContent);
  console.log(`Generated .env.local at ${envPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
