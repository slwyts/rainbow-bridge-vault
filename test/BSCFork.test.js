const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * BSC Fork Tests - 测试BSC链上的合约功能
 * 运行方式: npm run test:bsc-specific
 */
describe("RainbowWarehouse - BSC Fork Tests", function () {
  // BSC 配置
  const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";
  const BSC_USDT_WHALE = "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3"; // Binance hot wallet
  
  let warehouse;
  let owner;
  let user1;
  let user2;
  let usdtContract;
  let usdtWhale;

  before(async function () {
    // 验证我们在BSC链上
    const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
    if (chainId !== 56n) {
      console.log("⚠️  警告: 当前链ID不是56 (BSC)");
      console.log("   请使用: npm run test:bsc-specific");
      this.skip();
    }
  });

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // 1. 部署合约
    const RainbowWarehouse = await ethers.getContractFactory("RainbowWarehouse");
    warehouse = await RainbowWarehouse.deploy(owner.address);
    await warehouse.waitForDeployment();

    // 2. 验证链配置
    const stablecoin = await warehouse.stablecoin();
    const stablecoinDecimals = await warehouse.stablecoinDecimals();
    expect(stablecoin.toLowerCase()).to.equal(BSC_USDT.toLowerCase());
    expect(stablecoinDecimals).to.equal(18);

    // 3. 获取USDT合约
    usdtContract = await ethers.getContractAt("IERC20", BSC_USDT);

    // 4. 模拟USDT巨鲸账户并分发USDT给测试账户
    await ethers.provider.send("hardhat_impersonateAccount", [BSC_USDT_WHALE]);
    usdtWhale = await ethers.getSigner(BSC_USDT_WHALE);

    // 给巨鲸账户充点ETH作为gas
    await owner.sendTransaction({
      to: BSC_USDT_WHALE,
      value: ethers.parseEther("1.0")
    });

    // 给测试账户分发USDT
    const transferAmount = ethers.parseEther("10000"); // 10,000 USDT (18位精度)
    await usdtContract.connect(usdtWhale).transfer(user1.address, transferAmount);
    await usdtContract.connect(usdtWhale).transfer(user2.address, transferAmount);
  });

  describe("部署和配置", function () {
    it("应该正确配置BSC参数", async function () {
      expect(await warehouse.stablecoin()).to.equal(BSC_USDT);
      expect(await warehouse.stablecoinDecimals()).to.equal(18);
      expect(await warehouse.MIN_AMOUNT_PER_PERIOD_SCALED()).to.equal(ethers.parseEther("5"));
      expect(await warehouse.protocolFeePerPeriod()).to.equal(ethers.parseEther("0.01"));
      expect(await warehouse.isXWaifuDiscountActive()).to.equal(false);
    });

    it("owner应该设置正确", async function () {
      expect(await warehouse.owner()).to.equal(owner.address);
    });
  });

  describe("U本位周期派发", function () {
    it("应该成功创建存款", async function () {
      const amountPerPeriod = ethers.parseEther("100"); // 100 USDT
      const periodSeconds = 86400; // 1天
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);

      // 计算费用
      const baseFee = totalAmount * 50n / 10000n; // 0.5%
      const protocolFee = ethers.parseEther("0.01") * BigInt(totalPeriods);
      const totalFee = baseFee + protocolFee;
      const totalToTransfer = totalAmount + totalFee;

      // 授权
      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);

      // 记录owner初始余额
      const ownerBalanceBefore = await usdtContract.balanceOf(owner.address);

      // 创建存款
      await expect(
        warehouse.connect(user1).createDeposit(amountPerPeriod, periodSeconds, totalPeriods, 0)
      ).to.emit(warehouse, "DepositCreated");

      // 验证存款数据
      const deposit = await warehouse.deposits(0);
      expect(deposit.user).to.equal(user1.address);
      expect(deposit.totalAmount).to.equal(totalAmount);
      expect(deposit.amountPerPeriod).to.equal(amountPerPeriod);
      expect(deposit.totalPeriods).to.equal(totalPeriods);
      expect(deposit.periodsWithdrawn).to.equal(0);

      // 验证费用已转给owner
      const ownerBalanceAfter = await usdtContract.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(totalFee);
    });

    it("应该正确计算不同期数的费用", async function () {
      const amountPerPeriod = ethers.parseEther("100");
      const testCases = [
        { periods: 5, expectedFeeBps: 50n },   // 0.5%
        { periods: 20, expectedFeeBps: 80n },  // 0.8%
        { periods: 50, expectedFeeBps: 100n }, // 1.0%
        { periods: 150, expectedFeeBps: 200n } // 2.0%
      ];

      for (const testCase of testCases) {
        const totalAmount = amountPerPeriod * BigInt(testCase.periods);
        const expectedBaseFee = totalAmount * testCase.expectedFeeBps / 10000n;
        const protocolFee = ethers.parseEther("0.01") * BigInt(testCase.periods);
        const totalFee = expectedBaseFee + protocolFee;
        const totalToTransfer = totalAmount + totalFee;

        await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);

        const ownerBalanceBefore = await usdtContract.balanceOf(owner.address);
        await warehouse.connect(user1).createDeposit(amountPerPeriod, 86400, testCase.periods, 0);
        const ownerBalanceAfter = await usdtContract.balanceOf(owner.address);

        expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(totalFee);
      }
    });

    it("应该能够按周期提取资金", async function () {
      const amountPerPeriod = ethers.parseEther("100");
      const periodSeconds = 3600; // 1小时
      const totalPeriods = 5;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = ethers.parseEther("0.01") * BigInt(totalPeriods);
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);
      await warehouse.connect(user1).createDeposit(amountPerPeriod, periodSeconds, totalPeriods, 0);

      // 第一次提取应该失败(时间未到)
      await expect(warehouse.connect(user1).withdraw(0)).to.be.revertedWith("Too soon");

      // 快进时间
      await time.increase(periodSeconds);

      // 第一次提取
      const balanceBefore = await usdtContract.balanceOf(user1.address);
      await warehouse.connect(user1).withdraw(0);
      const balanceAfter = await usdtContract.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(amountPerPeriod);

      // 验证存款状态
      const deposit = await warehouse.deposits(0);
      expect(deposit.periodsWithdrawn).to.equal(1);

      // 第二次提取
      await time.increase(periodSeconds);
      await warehouse.connect(user1).withdraw(0);
      const deposit2 = await warehouse.deposits(0);
      expect(deposit2.periodsWithdrawn).to.equal(2);
    });

    it("应该能够紧急取消存款", async function () {
      const amountPerPeriod = ethers.parseEther("100");
      const periodSeconds = 3600;
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = ethers.parseEther("0.01") * BigInt(totalPeriods);
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);
      await warehouse.connect(user1).createDeposit(amountPerPeriod, periodSeconds, totalPeriods, 0);

      // 提取2期后取消
      await time.increase(periodSeconds);
      await warehouse.connect(user1).withdraw(0);
      await time.increase(periodSeconds);
      await warehouse.connect(user1).withdraw(0);

      // 紧急取消
      const balanceBefore = await usdtContract.balanceOf(user1.address);
      await warehouse.connect(user1).emergencyCancelDeposit(0);
      const balanceAfter = await usdtContract.balanceOf(user1.address);

      // 应该收到剩余8期的资金
      const expectedRefund = amountPerPeriod * 8n;
      expect(balanceAfter - balanceBefore).to.equal(expectedRefund);

      // 验证无法再提取
      const deposit = await warehouse.deposits(0);
      expect(deposit.periodsWithdrawn).to.equal(totalPeriods);
    });
  });

  describe("币本位锁仓 (ERC20)", function () {
    it("应该能够创建ERC20代币锁仓", async function () {
      const lockAmount = ethers.parseEther("1000"); // 1000 USDT
      const unlockTime = (await time.latest()) + 86400 * 30; // 30天后

      // 计算费用
      const fee = lockAmount * 5n / 1000n; // 0.5%
      const amountToLock = lockAmount - fee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), lockAmount);

      const ownerBalanceBefore = await usdtContract.balanceOf(owner.address);
      await expect(
        warehouse.connect(user1).createTokenLockup(BSC_USDT, lockAmount, unlockTime)
      ).to.emit(warehouse, "LockupCreated");

      // 验证锁仓数据
      const lockup = await warehouse.tokenLockups(0);
      expect(lockup.user).to.equal(user1.address);
      expect(lockup.tokenAddress).to.equal(BSC_USDT);
      expect(lockup.amountLocked).to.equal(amountToLock);
      expect(lockup.withdrawn).to.equal(false);

      // 验证费用已转给owner
      const ownerBalanceAfter = await usdtContract.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(fee);
    });

    it("应该能够解锁并提取代币", async function () {
      const lockAmount = ethers.parseEther("1000");
      const unlockTime = (await time.latest()) + 3600; // 1小时后
      const fee = lockAmount * 5n / 1000n;
      const amountToLock = lockAmount - fee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), lockAmount);
      await warehouse.connect(user1).createTokenLockup(BSC_USDT, lockAmount, unlockTime);

      // 解锁前不能提取
      await expect(warehouse.connect(user1).withdrawTokenLockup(0)).to.be.revertedWith("Not unlocked");

      // 快进时间
      await time.increaseTo(unlockTime);

      // 提取
      const balanceBefore = await usdtContract.balanceOf(user1.address);
      await warehouse.connect(user1).withdrawTokenLockup(0);
      const balanceAfter = await usdtContract.balanceOf(user1.address);

      expect(balanceAfter - balanceBefore).to.equal(amountToLock);

      // 验证不能重复提取
      await expect(warehouse.connect(user1).withdrawTokenLockup(0)).to.be.revertedWith("Already withdrawn");
    });
  });

  describe("币本位锁仓 (原生代币)", function () {
    it("应该能够创建原生BNB锁仓", async function () {
      const lockAmount = ethers.parseEther("1"); // 1 BNB
      const unlockTime = (await time.latest()) + 86400 * 30; // 30天后
      const fee = lockAmount * 5n / 1000n;
      const amountToLock = lockAmount - fee;

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      await expect(
        warehouse.connect(user1).createTokenLockup(ethers.ZeroAddress, 0, unlockTime, { value: lockAmount })
      ).to.emit(warehouse, "LockupCreated");

      // 验证锁仓数据
      const lockup = await warehouse.tokenLockups(0);
      expect(lockup.user).to.equal(user1.address);
      expect(lockup.tokenAddress).to.equal(ethers.ZeroAddress);
      expect(lockup.amountLocked).to.equal(amountToLock);

      // 验证费用已转给owner
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(fee);
    });

    it("应该能够解锁并提取原生BNB", async function () {
      const lockAmount = ethers.parseEther("0.5");
      const unlockTime = (await time.latest()) + 3600;
      const fee = lockAmount * 5n / 1000n;
      const amountToLock = lockAmount - fee;

      await warehouse.connect(user1).createTokenLockup(ethers.ZeroAddress, 0, unlockTime, { value: lockAmount });

      await time.increaseTo(unlockTime);

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await warehouse.connect(user1).withdrawTokenLockup(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      // 考虑gas费用
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(amountToLock);
    });
  });

  describe("权限控制", function () {
    it("非owner不能提取不属于自己的存款", async function () {
      const amountPerPeriod = ethers.parseEther("100");
      const totalAmount = amountPerPeriod * 5n;
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = ethers.parseEther("0.01") * 5n;
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);
      await warehouse.connect(user1).createDeposit(amountPerPeriod, 3600, 5, 0);

      await time.increase(3600);
      await expect(warehouse.connect(user2).withdraw(0)).to.be.revertedWith("Not owner");
    });

    it("非owner不能提取不属于自己的锁仓", async function () {
      const lockAmount = ethers.parseEther("1000");
      const unlockTime = (await time.latest()) + 3600;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), lockAmount);
      await warehouse.connect(user1).createTokenLockup(BSC_USDT, lockAmount, unlockTime);

      await time.increaseTo(unlockTime);
      await expect(warehouse.connect(user2).withdrawTokenLockup(0)).to.be.revertedWith("Not owner");
    });
  });

  describe("边界条件", function () {
    it("应该拒绝低于最小金额的存款", async function () {
      const tooLowAmount = ethers.parseEther("4.99"); // 低于5 USDT
      await usdtContract.connect(user1).approve(await warehouse.getAddress(), tooLowAmount * 10n);
      
      await expect(
        warehouse.connect(user1).createDeposit(tooLowAmount, 3600, 10, 0)
      ).to.be.revertedWith("Amount too low");
    });

    it("应该拒绝超过最大期数的存款", async function () {
      const amountPerPeriod = ethers.parseEther("100");
      const totalAmount = amountPerPeriod * 366n;
      const baseFee = totalAmount * 200n / 10000n;
      const protocolFee = ethers.parseEther("0.01") * 366n;
      
      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalAmount + baseFee + protocolFee);
      
      await expect(
        warehouse.connect(user1).createDeposit(amountPerPeriod, 3600, 366, 0)
      ).to.be.revertedWith("Invalid periods");
    });

    it("应该拒绝过去时间的锁仓", async function () {
      const lockAmount = ethers.parseEther("1000");
      const pastTime = (await time.latest()) - 3600;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), lockAmount);
      
      await expect(
        warehouse.connect(user1).createTokenLockup(BSC_USDT, lockAmount, pastTime)
      ).to.be.revertedWith("Invalid unlock time");
    });
  });
});
