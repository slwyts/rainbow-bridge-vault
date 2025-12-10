import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

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
      chainId: 31337, // Use 31337 for local dev to enable mock token injection
    },
    hardhatBsc: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 56, // BSC Mainnet for testing
    },
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
  },
});
