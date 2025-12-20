# 环境变量配置

每条链的合约地址配置在单独的文件中，便于管理。

## 文件结构

```
env/
├── global.env      # 全局配置
├── localnet.env    # Hardhat 本地开发网络 (31337)
├── bsc-testnet.env # BSC 测试网 (97)
├── bsc.env         # BSC 主网 (56)
├── xlayer.env      # X Layer (196)
└── arbitrum.env    # Arbitrum One (42161)
```

## 如何启用/禁用链

**只有配置了 `WAREHOUSE_ADDRESS` 的链才会在前端显示。**

### 启用链
取消对应文件中 `WAREHOUSE_ADDRESS` 的注释并填入地址：
```bash
NEXT_PUBLIC_BSC_WAREHOUSE_ADDRESS=0x1234...
```

### 禁用链
注释掉或删除 `WAREHOUSE_ADDRESS`：
```bash
# NEXT_PUBLIC_BSC_WAREHOUSE_ADDRESS=0x1234...
```

## 代币地址

- `USDT_ADDRESS` / `USDC_ADDRESS` - 主流稳定币地址（主网已预填）
- `XWAIFU_ADDRESS` - 项目代币地址（可选）

## 运行

```bash
# 开发模式（自动加载所有 env 文件）
npm run dev

# 生产构建
npm run build
```
