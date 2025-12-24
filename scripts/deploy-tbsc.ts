import { parseUnits } from "viem";
import hre from "hardhat";
import "@nomicfoundation/hardhat-toolbox-viem";
import fs from "fs";
import path from "path";

async function main() {
  console.log("HRE keys:", Object.keys(hre));
  let viem = (hre as any).viem;

  if (!viem && hre.network && (hre.network as any).connect) {
    console.log("Connecting to network...");
    const connection = await (hre.network as any).connect();
    viem = connection.viem;
  }

  if (!viem) {
    console.error(
      "Error: 'viem' object not found on 'hre' or network connection."
    );
    process.exit(1);
  }

  const [deployer] = await viem.getWalletClients();

  console.log(
    "Deploying contracts with the account:",
    deployer.account.address
  );

  // 1. Deploy Mock Tokens
  console.log("Deploying Mock Tokens...");

  const usdt = await viem.deployContract("MockERC20", [
    "Tether USD",
    "USDT",
    18,
  ]);
  console.log("USDT deployed to:", usdt.address);

  const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 18]);
  console.log("USDC deployed to:", usdc.address);

  // Mint tokens to deployer
  const mintAmount = parseUnits("100000", 18);
  console.log("Minting 100,000 USDT to deployer...");
  await usdt.write.mint([deployer.account.address, mintAmount]);
  console.log("Minting 100,000 USDC to deployer...");
  await usdc.write.mint([deployer.account.address, mintAmount]);

  // Deploy RainbowWarehouse
  // Constructor args: _initialOwner, _xwaifuToken
  // For BSC Testnet, _xwaifuToken is ignored by the contract logic (sets to address(0)),
  // but we still need to pass a valid address type.

  const initialOwner = deployer.account.address;
  const dummyToken = "0x0000000000000000000000000000000000000000";

  console.log("Deploying RainbowWarehouse...");
  const rainbowWarehouse = await viem.deployContract("RainbowWarehouse", [
    initialOwner,
    dummyToken,
  ]);

  console.log("RainbowWarehouse deployed to:", rainbowWarehouse.address);

  // Generate .env file for frontend
  const envContent = `NEXT_PUBLIC_BSC_TESTNET_WAREHOUSE_ADDRESS=${rainbowWarehouse.address}
NEXT_PUBLIC_BSC_TESTNET_USDT_ADDRESS=${usdt.address}
NEXT_PUBLIC_BSC_TESTNET_USDC_ADDRESS=${usdc.address}
NEXT_PUBLIC_BSC_TESTNET_CHAIN_ID=97`;

  const envPath = path.join(process.cwd(), "../.env.bsc-testnet");
  fs.writeFileSync(envPath, envContent);
  console.log(`Generated .env.bsc-testnet at ${envPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
