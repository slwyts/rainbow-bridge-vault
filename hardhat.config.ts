import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig, configVariable } from "hardhat/config";
import dotenv from "dotenv";

// 加载合约相关的环境变量
dotenv.config({ path: "env/bsc-testnet.env" });

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.30",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 100000,
          },
        },
      },
      production: {
        version: "0.8.30",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 100000,
          },
        },
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31337,
    },
    hardhatBsc: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 56,
    },
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    bscTestnet: {
      type: "http",
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
});
