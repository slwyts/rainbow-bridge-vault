import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import * as dotenv from "dotenv";

// 加载部署私钥
dotenv.config({ path: ".env.deploy" });

const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

// 加载合约相关的环境变量
export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.33",
        settings: {
          viaIR: true,
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 100000,
          },
        },
      },
      production: {
        version: "0.8.33",
        settings: {
          viaIR: true,
          metadata: {
            bytecodeHash: "none",
          },
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
    xlayer: {
      type: "http",
      chainType: "l1",
      url: "https://rpc.xlayer.tech",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 196,
      gas: 8000000,
    },
    bsc: {
      type: "http",
      chainType: "l1",
      url: "https://bsc-dataseed.binance.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 56,
      gas: 8000000,
    },
    arbitrum: {
      type: "http",
      chainType: "l1",
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 42161,
      gas: 8000000,
    },
    ethereum: {
      type: "http",
      chainType: "l1",
      url: "https://eth.llamarpc.com",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 1,
      gas: 8000000,
    },
    polygon: {
      type: "http",
      chainType: "l1",
      url: "https://polygon-rpc.com",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 137,
      gas: 8000000,
      gasPrice: 9500000000000,
    },
    base: {
      type: "http",
      chainType: "l1",
      url: "https://mainnet.base.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 8453,
      gas: 8000000,
    },
    bscTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 97,
      gas: 8000000, // Increase gas limit for contract deployment
    },
  },
});
