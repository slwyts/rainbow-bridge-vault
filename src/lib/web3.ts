import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { CHAIN_CONFIGS, getAllChainIds } from "./chains";

// 从统一配置动态生成 wagmi config
const chains = getAllChainIds().map((id) => CHAIN_CONFIGS[id].viemChain);
const transports = Object.fromEntries(
  getAllChainIds().map((id) => [
    CHAIN_CONFIGS[id].chainId,
    http(CHAIN_CONFIGS[id].rpcUrl),
  ])
);

export const config = createConfig({
  // @ts-expect-error wagmi chains type is strict
  chains,
  connectors: [injected()],
  transports,
});
