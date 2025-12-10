import { createConfig, http } from "wagmi";
import { hardhat, bsc, arbitrum, mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Custom X Layer chain definition (not in wagmi by default)
const xLayer = {
  id: 196,
  name: "X Layer",
  nativeCurrency: {
    decimals: 18,
    name: "OKB",
    symbol: "OKB",
  },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: {
      name: "OKX Explorer",
      url: "https://www.okx.com/explorer/xlayer",
    },
  },
} as const;

export const config = createConfig({
  chains: [hardhat, xLayer, bsc, arbitrum],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [xLayer.id]: http("https://rpc.xlayer.tech"),
    [bsc.id]: http("https://bsc-dataseed.binance.org"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
  },
});
