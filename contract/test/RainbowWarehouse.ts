// @ts-nocheck
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import {
  type Address,
  type WalletClient,
  type PublicClient,
  parseUnits,
  getAddress,
  zeroAddress,
} from "viem";

// XLayer 配置 (chainId 196)
const USDT_DECIMALS = 6;
const XWAIFU_DECIMALS = 18;

const parseUsdt = (amount: string | number) => parseUnits(String(amount), USDT_DECIMALS);
const parseXwaifu = (amount: string | number) => parseUnits(String(amount), XWAIFU_DECIMALS);

describe("RainbowWarehouse", async () => {
  const { viem } = await network.connect();

  let publicClient: PublicClient;
  let owner: WalletClient;
  let user1: WalletClient;
  let user2: WalletClient;
  let ownerAddress: Address;
  let user1Address: Address;
  let user2Address: Address;

  let warehouse: any;
  let usdt: any;
  let xwaifu: any;
  let warehouseAddress: Address;
  let usdtAddress: Address;
  let xwaifuAddress: Address;

  beforeEach(async () => {
    publicClient = await viem.getPublicClient();
    const wallets = await viem.getWalletClients();
    [owner, user1, user2] = wallets;
    ownerAddress = owner.account!.address;
    user1Address = user1.account!.address;
    user2Address = user2.account!.address;

    // 部署 Mock USDT (6 decimals)
    usdt = await viem.deployContract("MockERC20", ["USDT", "USDT", USDT_DECIMALS]);
    usdtAddress = usdt.address;

    // 部署 Mock xwaifu (18 decimals)
    xwaifu = await viem.deployContract("MockERC20", ["xwaifu", "XWAIFU", XWAIFU_DECIMALS]);
    xwaifuAddress = xwaifu.address;

    // 部署 RainbowWarehouse，传入 mock 代币地址
    warehouse = await viem.deployContract("RainbowWarehouse", [
      ownerAddress,
      xwaifuAddress,
    ]);
    warehouseAddress = warehouse.address;

    // 给用户铸造代币
    await usdt.write.mint([user1Address, parseUsdt("100000")]);
    await usdt.write.mint([user2Address, parseUsdt("100000")]);
    await xwaifu.write.mint([user1Address, parseXwaifu("50000")]);
    await xwaifu.write.mint([user2Address, parseXwaifu("50000")]);
  });

  describe("部署检查", () => {
    it("应该正确设置 owner", async () => {
      const contractOwner = await warehouse.read.owner();
      assert.strictEqual(getAddress(contractOwner), getAddress(ownerAddress));
    });



    it("应该正确设置 xwaifu 代币", async () => {
      const token = await warehouse.read.xwaifuToken();
      assert.strictEqual(getAddress(token), getAddress(xwaifuAddress));
    });


  });

  describe("U本位周期派发 - createDeposit", () => {
    beforeEach(async () => {
      const user1Usdt = await viem.getContractAt("MockERC20", usdtAddress, { client: { wallet: user1 } });
      await user1Usdt.write.approve([warehouseAddress, parseUsdt("100000")]);
    });

    it("应该成功创建存款 (10期, 0.5%费用)", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amountPerPeriod = parseUsdt("100");
      const periodSeconds = 86400n;
      const totalPeriods = 10;

      const balanceBefore = await usdt.read.balanceOf([user1Address]);
      await user1Warehouse.write.createDeposit([usdtAddress, amountPerPeriod, periodSeconds, totalPeriods, 0n]);
      const balanceAfter = await usdt.read.balanceOf([user1Address]);

      // 总金额 = 100 * 10 = 1000U
      // 基础费用 = 1000 * 0.5% = 5U
      // 无协议费
      const totalAmount = parseUsdt("1000");
      const baseFee = (totalAmount * 50n) / 10000n;
      const expectedPaid = totalAmount + baseFee;

      assert.strictEqual(balanceBefore - balanceAfter, expectedPaid);

      const deposit = await warehouse.read.deposits([0n]);
      assert.strictEqual(getAddress(deposit[0]), getAddress(user1Address));
      assert.strictEqual(deposit[2], amountPerPeriod); // Check amountPerPeriod
    });

    it("应该成功创建存款 (30期, 0.8%费用)", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      await user1Warehouse.write.createDeposit([usdtAddress, parseUsdt("10"), 86400n, 30, 0n]);

      const deposit = await warehouse.read.deposits([0n]);
      assert.strictEqual(deposit[2], parseUsdt("10"));
    });

    it("应该成功创建存款 (100期, 1%费用)", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      await user1Warehouse.write.createDeposit([usdtAddress, parseUsdt("10"), 86400n, 100, 0n]);

      const deposit = await warehouse.read.deposits([0n]);
      assert.strictEqual(deposit[2], parseUsdt("10"));
    });

    it("应该成功创建存款 (365期, 2%费用)", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      await user1Warehouse.write.createDeposit([usdtAddress, parseUsdt("10"), 86400n, 365, 0n]);

      const deposit = await warehouse.read.deposits([0n]);
      assert.strictEqual(deposit[2], parseUsdt("10"));
    });

    it("应该拒绝0金额存款", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      await assert.rejects(
        user1Warehouse.write.createDeposit([usdtAddress, 0n, 86400n, 10, 0n])
      );
    });

    it("应该拒绝期数为0的存款", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      await assert.rejects(
        user1Warehouse.write.createDeposit([usdtAddress, parseUsdt("10"), 86400n, 0, 0n])
      );
    });

    it("应该拒绝超过365期的存款", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      await assert.rejects(
        user1Warehouse.write.createDeposit([usdtAddress, parseUsdt("10"), 86400n, 366, 0n])
      );
    });
  });

  describe("U本位周期派发 - withdraw", () => {
    beforeEach(async () => {
      const user1Usdt = await viem.getContractAt("MockERC20", usdtAddress, { client: { wallet: user1 } });
      await user1Usdt.write.approve([warehouseAddress, parseUsdt("100000")]);

      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      await user1Warehouse.write.createDeposit([usdtAddress, parseUsdt("100"), 86400n, 10, 0n]);
    });

    it("应该在时间到后成功提款", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      // 快进1天
      await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
      await publicClient.request({ method: "evm_mine" as any, params: [] });

      const balanceBefore = await usdt.read.balanceOf([user1Address]);
      await user1Warehouse.write.withdraw([0n]);
      const balanceAfter = await usdt.read.balanceOf([user1Address]);

      assert.strictEqual(balanceAfter - balanceBefore, parseUsdt("100"));

      const deposit = await warehouse.read.deposits([0n]);
      assert.strictEqual(deposit[5], 1);
    });

    it("应该拒绝时间未到的提款", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      await assert.rejects(user1Warehouse.write.withdraw([0n]));
    });

    it("应该拒绝非所有者提款", async () => {
      await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
      await publicClient.request({ method: "evm_mine" as any, params: [] });

      const user2Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user2 },
      });

      await assert.rejects(user2Warehouse.write.withdraw([0n]));
    });

    it("应该能连续提取多期", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      for (let i = 0; i < 3; i++) {
        await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
        await publicClient.request({ method: "evm_mine" as any, params: [] });
        await user1Warehouse.write.withdraw([0n]);
      }

      const deposit = await warehouse.read.deposits([0n]);
      assert.strictEqual(deposit[5], 3);
    });

    it("应该拒绝已全部提取后的提款", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      for (let i = 0; i < 10; i++) {
        await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
        await publicClient.request({ method: "evm_mine" as any, params: [] });
        await user1Warehouse.write.withdraw([0n]);
      }

      await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
      await publicClient.request({ method: "evm_mine" as any, params: [] });

      await assert.rejects(user1Warehouse.write.withdraw([0n]));
    });
  });

  describe("U本位 - 紧急取消", () => {
    beforeEach(async () => {
      const user1Usdt = await viem.getContractAt("MockERC20", usdtAddress, { client: { wallet: user1 } });
      await user1Usdt.write.approve([warehouseAddress, parseUsdt("100000")]);

      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      await user1Warehouse.write.createDeposit([usdtAddress, parseUsdt("100"), 86400n, 10, 0n]);
    });

    it("应该能紧急取消并取回全部剩余资金", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const balanceBefore = await usdt.read.balanceOf([user1Address]);
      await user1Warehouse.write.emergencyCancel([0n]);
      const balanceAfter = await usdt.read.balanceOf([user1Address]);

      assert.strictEqual(balanceAfter - balanceBefore, parseUsdt("1000"));

      const deposit = await warehouse.read.deposits([0n]);
      assert.strictEqual(deposit[5], 10);
    });

    it("应该能在部分提取后紧急取消", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      for (let i = 0; i < 3; i++) {
        await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
        await publicClient.request({ method: "evm_mine" as any, params: [] });
        await user1Warehouse.write.withdraw([0n]);
      }

      const balanceBefore = await usdt.read.balanceOf([user1Address]);
      await user1Warehouse.write.emergencyCancel([0n]);
      const balanceAfter = await usdt.read.balanceOf([user1Address]);

      assert.strictEqual(balanceAfter - balanceBefore, parseUsdt("700"));
    });

    it("应该拒绝非所有者取消", async () => {
      const user2Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user2 },
      });

      await assert.rejects(user2Warehouse.write.emergencyCancel([0n]));
    });
  });

  describe("币本位锁仓 - ERC20", () => {
    beforeEach(async () => {
      const user1Xwaifu = await viem.getContractAt("MockERC20", xwaifuAddress, { client: { wallet: user1 } });
      await user1Xwaifu.write.approve([warehouseAddress, parseXwaifu("50000")]);
    });

    it("应该成功创建 ERC20 锁仓", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amount = parseXwaifu("1000");
      const block = await publicClient.getBlock();
      const unlockTime = block.timestamp + BigInt(86400 * 30);

      const balanceBefore = await xwaifu.read.balanceOf([user1Address]);
      await user1Warehouse.write.createLockup([xwaifuAddress, amount, unlockTime]);
      const balanceAfter = await xwaifu.read.balanceOf([user1Address]);

      assert.strictEqual(balanceBefore - balanceAfter, amount);

      const lockup = await warehouse.read.lockups([0n]);
      const expectedLocked = amount - (amount * 5n) / 1000n;
      assert.strictEqual(lockup[2], expectedLocked);
      assert.strictEqual(lockup[4], false);
    });

    it("应该收取0.5%手续费给owner", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amount = parseXwaifu("1000");
      const block = await publicClient.getBlock();
      const unlockTime = block.timestamp + BigInt(86400 * 30);

      const ownerBalanceBefore = await xwaifu.read.balanceOf([ownerAddress]);
      await user1Warehouse.write.createLockup([xwaifuAddress, amount, unlockTime]);
      const ownerBalanceAfter = await xwaifu.read.balanceOf([ownerAddress]);

      const expectedFee = (amount * 5n) / 1000n;
      assert.strictEqual(ownerBalanceAfter - ownerBalanceBefore, expectedFee);
    });

    it("应该在解锁后成功提取", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amount = parseXwaifu("1000");
      const block = await publicClient.getBlock();
      const unlockTime = block.timestamp + BigInt(86400);

      await user1Warehouse.write.createLockup([xwaifuAddress, amount, unlockTime]);

      await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
      await publicClient.request({ method: "evm_mine" as any, params: [] });

      const balanceBefore = await xwaifu.read.balanceOf([user1Address]);
      await user1Warehouse.write.withdrawLockup([0n]);
      const balanceAfter = await xwaifu.read.balanceOf([user1Address]);

      const expectedLocked = amount - (amount * 5n) / 1000n;
      assert.strictEqual(balanceAfter - balanceBefore, expectedLocked);

      const lockup = await warehouse.read.lockups([0n]);
      assert.strictEqual(lockup[4], true);
    });

    it("应该拒绝未解锁时提取", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amount = parseXwaifu("1000");
      const block = await publicClient.getBlock();
      const unlockTime = block.timestamp + BigInt(86400 * 30);

      await user1Warehouse.write.createLockup([xwaifuAddress, amount, unlockTime]);

      await assert.rejects(user1Warehouse.write.withdrawLockup([0n]));
    });

    it("应该拒绝重复提取", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amount = parseXwaifu("1000");
      const block = await publicClient.getBlock();
      const unlockTime = block.timestamp + BigInt(86400);

      await user1Warehouse.write.createLockup([xwaifuAddress, amount, unlockTime]);

      await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
      await publicClient.request({ method: "evm_mine" as any, params: [] });

      await user1Warehouse.write.withdrawLockup([0n]);

      await assert.rejects(user1Warehouse.write.withdrawLockup([0n]));
    });
  });

  describe("币本位锁仓 - 原生代币", () => {
    it("应该成功创建原生代币锁仓", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amount = parseUnits("1", 18);
      const block = await publicClient.getBlock();
      const unlockTime = block.timestamp + BigInt(86400);

      await user1Warehouse.write.createLockup([zeroAddress, 0n, unlockTime], { value: amount });

      const lockup = await warehouse.read.lockups([0n]);
      const expectedLocked = amount - (amount * 5n) / 1000n;
      assert.strictEqual(lockup[2], expectedLocked);
    });

    it("应该成功提取原生代币锁仓", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amount = parseUnits("1", 18);
      const block = await publicClient.getBlock();
      const unlockTime = block.timestamp + BigInt(86400);

      await user1Warehouse.write.createLockup([zeroAddress, 0n, unlockTime], { value: amount });

      await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
      await publicClient.request({ method: "evm_mine" as any, params: [] });

      const balanceBefore = await publicClient.getBalance({ address: user1Address });
      const tx = await user1Warehouse.write.withdrawLockup([0n]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      const balanceAfter = await publicClient.getBalance({ address: user1Address });

      const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
      const expectedLocked = amount - (amount * 5n) / 1000n;

      assert.strictEqual(balanceAfter - balanceBefore + gasUsed, expectedLocked);
    });
  });

  describe("xwaifu 优惠机制", () => {
    beforeEach(async () => {
      const user1Usdt = await viem.getContractAt("MockERC20", usdtAddress, { client: { wallet: user1 } });
      const user1Xwaifu = await viem.getContractAt("MockERC20", xwaifuAddress, { client: { wallet: user1 } });
      await user1Usdt.write.approve([warehouseAddress, parseUsdt("100000")]);
      await user1Xwaifu.write.approve([warehouseAddress, parseXwaifu("50000")]);
    });

    it("应该在满足条件时获得半价优惠", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const block = await publicClient.getBlock();
      
      // 1. 创建占位锁仓 (lockupId=0)
      await user1Warehouse.write.createLockup([xwaifuAddress, parseXwaifu("100"), block.timestamp + 86400n]);

      // 2. 创建符合条件的 xwaifu 锁仓 (lockupId=1)
      const stakeAmount = parseXwaifu("15000");
      const unlockTime = block.timestamp + BigInt(366 * 86400);

      await user1Warehouse.write.createLockup([xwaifuAddress, stakeAmount, unlockTime]);

      // 3. 创建存款使用优惠 (使用 lockupId = 1)
      const amountPerPeriod = parseUsdt("100");
      const totalPeriods = 10;
      const period = 86400n;
      
      // 10期 -> 0.5% 费率
      // 总金额 = 1000
      // 正常费用 = 5
      // 优惠费用 = 2.5
      
      const balanceBefore = await usdt.read.balanceOf([user1Address]);
      
      await user1Warehouse.write.createDeposit([usdtAddress, amountPerPeriod, period, totalPeriods, 1n]);
      
      const balanceAfter = await usdt.read.balanceOf([user1Address]);
      
      // 扣除金额 = 1000 + 2.5 = 1002.5
      assert.strictEqual(balanceBefore - balanceAfter, parseUsdt("1002.5"));

      const deposit = await warehouse.read.deposits([0n]);
      assert.strictEqual(deposit[2], amountPerPeriod);
    });

    it("应该在质押金额不足时收取全额费用", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const block = await publicClient.getBlock();
      
      await user1Warehouse.write.createLockup([xwaifuAddress, parseXwaifu("100"), block.timestamp + 86400n]);
      
      // 不足额锁仓
      const stakeAmount = parseXwaifu("5000");
      const unlockTime = block.timestamp + BigInt(366 * 86400);
      await user1Warehouse.write.createLockup([xwaifuAddress, stakeAmount, unlockTime]);

      const balanceBefore = await usdt.read.balanceOf([user1Address]);
      // 尝试使用优惠 (lockupId=1)
      await user1Warehouse.write.createDeposit([usdtAddress, parseUsdt("100"), 86400n, 10, 1n]);
      const balanceAfter = await usdt.read.balanceOf([user1Address]);

      // 应该收取全额费用: 1000 + 5 = 1005
      assert.strictEqual(balanceBefore - balanceAfter, parseUsdt("1005"));
    });

    it("应该在质押时长不足时收取全额费用", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const block = await publicClient.getBlock();
      
      await user1Warehouse.write.createLockup([xwaifuAddress, parseXwaifu("100"), block.timestamp + 86400n]);
      
      // 时长不足锁仓
      const stakeAmount = parseXwaifu("15000");
      const unlockTime = block.timestamp + BigInt(100 * 86400);
      await user1Warehouse.write.createLockup([xwaifuAddress, stakeAmount, unlockTime]);

      const balanceBefore = await usdt.read.balanceOf([user1Address]);
      // 尝试使用优惠 (lockupId=1)
      await user1Warehouse.write.createDeposit([usdtAddress, parseUsdt("100"), 86400n, 10, 1n]);
      const balanceAfter = await usdt.read.balanceOf([user1Address]);

      // 应该收取全额费用: 1000 + 5 = 1005
      assert.strictEqual(balanceBefore - balanceAfter, parseUsdt("1005"));
    });
  });

  describe("receive 函数", () => {
    it("直接发送原生代币应该转给owner", async () => {
      const amount = parseUnits("1", 18);

      const ownerBalanceBefore = await publicClient.getBalance({ address: ownerAddress });

      await user1.sendTransaction({
        to: warehouseAddress,
        value: amount,
      });

      const ownerBalanceAfter = await publicClient.getBalance({ address: ownerAddress });
      assert.strictEqual(ownerBalanceAfter - ownerBalanceBefore, amount);
    });
  });

  describe("U本位周期派发 - 原生代币", () => {
    it("应该成功创建原生代币存款", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amountPerPeriod = parseUnits("1", 18);
      const periodSeconds = 86400n;
      const totalPeriods = 10;

      // 总金额 = 1 * 10 = 10 ETH
      // 费用 = 10 * 0.5% = 0.05 ETH
      const totalAmount = parseUnits("10", 18);
      const fee = parseUnits("0.05", 18);
      const totalPayable = totalAmount + fee;

      const balanceBefore = await publicClient.getBalance({ address: user1Address });
      const tx = await user1Warehouse.write.createDeposit(
        [zeroAddress, amountPerPeriod, periodSeconds, totalPeriods, 0n],
        { value: totalPayable }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      const balanceAfter = await publicClient.getBalance({ address: user1Address });

      const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
      assert.strictEqual(balanceBefore - balanceAfter - gasUsed, totalPayable);

      const deposit = await warehouse.read.deposits([0n]);
      assert.strictEqual(deposit[2], amountPerPeriod);
    });

    it("应该成功提取原生代币存款", async () => {
      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amountPerPeriod = parseUnits("1", 18);
      const periodSeconds = 86400n;
      const totalPeriods = 10;
      const totalPayable = parseUnits("10.05", 18);

      await user1Warehouse.write.createDeposit(
        [zeroAddress, amountPerPeriod, periodSeconds, totalPeriods, 0n],
        { value: totalPayable }
      );

      await publicClient.request({ method: "evm_increaseTime" as any, params: [86400] });
      await publicClient.request({ method: "evm_mine" as any, params: [] });

      const balanceBefore = await publicClient.getBalance({ address: user1Address });
      const tx = await user1Warehouse.write.withdraw([0n]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      const balanceAfter = await publicClient.getBalance({ address: user1Address });

      const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
      assert.strictEqual(balanceAfter - balanceBefore + gasUsed, amountPerPeriod);
    });
  });

  describe("币本位锁仓 - 紧急取消", () => {
    it("应该能紧急取消锁仓并取回资金", async () => {
      const user1Xwaifu = await viem.getContractAt("MockERC20", xwaifuAddress, { client: { wallet: user1 } });
      await user1Xwaifu.write.approve([warehouseAddress, parseXwaifu("50000")]);

      const user1Warehouse = await viem.getContractAt("RainbowWarehouse", warehouseAddress, {
        client: { wallet: user1 },
      });

      const amount = parseXwaifu("1000");
      const block = await publicClient.getBlock();
      const unlockTime = block.timestamp + BigInt(86400 * 30);

      await user1Warehouse.write.createLockup([xwaifuAddress, amount, unlockTime]);

      const balanceBefore = await xwaifu.read.balanceOf([user1Address]);
      await user1Warehouse.write.emergencyCancelLockup([0n]);
      const balanceAfter = await xwaifu.read.balanceOf([user1Address]);

      // 扣除手续费后的金额
      const expectedLocked = amount - (amount * 5n) / 1000n;
      assert.strictEqual(balanceAfter - balanceBefore, expectedLocked);

      const lockup = await warehouse.read.lockups([0n]);
      assert.strictEqual(lockup[4], true); // withdrawn
    });
  });
});
