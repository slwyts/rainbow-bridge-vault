# Rainbow Bridge Vault

多链支持的资产管理系统

## 环境要求

- Node.js >= 22
- npm >= 10

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

编译智能合约并构建前端应用：

```bash
npm run build
```

### 3. 启动服务

启动生产环境服务：

```bash
npm run start
```

服务默认运行在 http://localhost:3000

## 开发环境

### 本地开发（推荐）

一键启动本地开发环境，包含本地 Hardhat 节点：

```bash
npm run dev:local
```

该命令会自动启动本地区块链节点并运行开发服务器，适合本地调试和测试。

### 标准开发模式

如需连接测试网或主网进行开发：

```bash
npm run dev
```

## 智能合约

### 编译合约

```bash
npm run compile
```

### 运行测试

```bash
npm run test
```

### 部署合约

部署智能合约到目标网络：

```bash
npm run deploy
```

## 其他命令

| 命令 | 说明 |
|------|------|
| `npm run lint` | 代码规范检查 |
| `npm run format` | 代码格式化 |
| `npm run clean` | 清理编译产物 |
| `npm run node` | 启动本地 Hardhat 节点 |
