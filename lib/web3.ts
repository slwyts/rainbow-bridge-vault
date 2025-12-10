import { createConfig, http } from "wagmi";
import { hardhat, bsc, bscTestnet, arbitrum, xLayer } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [hardhat, xLayer, bsc, bscTestnet, arbitrum],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [xLayer.id]: http("https://rpc.xlayer.tech"),
    [bsc.id]: http("https://bsc-dataseed.binance.org"),
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
  },
});
