// Import ABI from contract build artifacts
import WarehouseArtifact from "../../artifacts/contracts/rainbowbridge.sol/RainbowWarehouse.json";
import MockERC20Artifact from "../../artifacts/contracts/mocks/MockERC20.sol/MockERC20.json";

export const warehouseAbi = WarehouseArtifact.abi;
export const erc20Abi = MockERC20Artifact.abi;
