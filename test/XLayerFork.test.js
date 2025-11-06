const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * XLayer Fork Tests - 测试XLayer链上的合约功能 (包括xwaifu优惠)
 * 运行方式: npm run test:xlayer-specific
 */
describe("RainbowWarehouse - XLayer Fork Tests", function () {
  // XLayer 配置
  const XLAYER_USDT = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736";
  const XLAYER_XWAIFU = "0x140abA9691353eD54479372c4E9580D558D954b1";
  
  // 注意: XLayer的USDT whale地址需要在实际测试时替换
  const XLAYER_USDT_WHALE = "0x1234567890123456789012345678901234567890"; // 需要替换为真实地址
  const XLAYER_XWAIFU_WHALE = "0x1234567890123456789012345678901234567890"; // 需要替换为真实地址
  
  let warehouse;
  let owner;
  let user1;
  let user2;
  let usdtContract;
  let xwaifuContract;
  let usdtWhale;
  let xwaifuWhale;

  before(async function () {
    // 验证我们在XLayer链上
    const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
    if (chainId !== 196n) {
      console.log("⚠️  警告: 当前链ID不是196 (XLayer)");
      console.log("   请使用: npm run test:xlayer-specific");
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
    expect(stablecoin.toLowerCase()).to.equal(XLAYER_USDT.toLowerCase());
    expect(stablecoinDecimals).to.equal(6);

    // 3. 获取代币合约
    usdtContract = await ethers.getContractAt("IERC20", XLAYER_USDT);
    xwaifuContract = await ethers.getContractAt("IERC20", XLAYER_XWAIFU);

    // 4. 模拟巨鲸账户
    try {
      await ethers.provider.send("hardhat_impersonateAccount", [XLAYER_USDT_WHALE]);
      await ethers.provider.send("hardhat_impersonateAccount", [XLAYER_XWAIFU_WHALE]);
      
      usdtWhale = await ethers.getSigner(XLAYER_USDT_WHALE);
      xwaifuWhale = await ethers.getSigner(XLAYER_XWAIFU_WHALE);

      // 给巨鲸账户充gas
      await owner.sendTransaction({ to: XLAYER_USDT_WHALE, value: ethers.parseEther("1.0") });
      await owner.sendTransaction({ to: XLAYER_XWAIFU_WHALE, value: ethers.parseEther("1.0") });

      // 分发代币
      const usdtAmount = 10000n * 10n ** 6n; // 10,000 USDT (6位精度)
      const xwaifuAmount = ethers.parseEther("50000"); // 50,000 xwaifu (18位精度)
      
      await usdtContract.connect(usdtWhale).transfer(user1.address, usdtAmount);
      await usdtContract.connect(usdtWhale).transfer(user2.address, usdtAmount);
      await xwaifuContract.connect(xwaifuWhale).transfer(user1.address, xwaifuAmount);
      await xwaifuContract.connect(xwaifuWhale).transfer(user2.address, xwaifuAmount);
    } catch (error) {
      console.log("⚠️  警告: 无法模拟巨鲸账户，可能需要更新whale地址");
      console.log("   错误:", error.message);
      this.skip();
    }
  });

  describe("部署和配置", function () {
    it("应该正确配置XLayer参数", async function () {
      expect(await warehouse.stablecoin()).to.equal(XLAYER_USDT);
      expect(await warehouse.stablecoinDecimals()).to.equal(6);
      expect(await warehouse.MIN_AMOUNT_PER_PERIOD_SCALED()).to.equal(5n * 10n ** 6n);
      expect(await warehouse.protocolFeePerPeriod()).to.equal(10000n); // 0.01 USDT (6位)
      expect(await warehouse.isXWaifuDiscountActive()).to.equal(true);
      expect(await warehouse.xwaifuToken()).to.equal(XLAYER_XWAIFU);
    });
  });

  describe("U本位周期派发 (无优惠)", function () {
    it("应该成功创建存款", async function () {
      const amountPerPeriod = 100n * 10n ** 6n; // 100 USDT (6位精度)
      const periodSeconds = 86400; // 1天
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);

      // 计算费用
      const baseFee = totalAmount * 50n / 10000n; // 0.5%
      const protocolFee = 10000n * BigInt(totalPeriods); // 0.01 USDT * 10
      const totalFee = baseFee + protocolFee;
      const totalToTransfer = totalAmount + totalFee;

      // 授权
      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);

      // 记录owner初始余额
      const ownerBalanceBefore = await usdtContract.balanceOf(owner.address);

      // 创建存款 (不使用优惠)
      await expect(
        warehouse.connect(user1).createDeposit(amountPerPeriod, periodSeconds, totalPeriods, 0)
      ).to.emit(warehouse, "DepositCreated");

      // 验证费用
      const ownerBalanceAfter = await usdtContract.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(totalFee);
    });

    it("应该能够按周期提取资金", async function () {
      const amountPerPeriod = 100n * 10n ** 6n;
      const periodSeconds = 3600; // 1小时
      const totalPeriods = 5;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = 10000n * BigInt(totalPeriods);
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);
      await warehouse.connect(user1).createDeposit(amountPerPeriod, periodSeconds, totalPeriods, 0);

      // 快进时间并提取
      await time.increase(periodSeconds);
      const balanceBefore = await usdtContract.balanceOf(user1.address);
      await warehouse.connect(user1).withdraw(0);
      const balanceAfter = await usdtContract.balanceOf(user1.address);
      
      expect(balanceAfter - balanceBefore).to.equal(amountPerPeriod);
    });
  });

  describe("xwaifu优惠功能", function () {
    it("应该能够创建符合优惠条件的xwaifu锁仓", async function () {
      const xwaifuAmount = ethers.parseEther("10000"); // 10,000 xwaifu
      const unlockTime = (await time.latest()) + (365 * 86400); // 1年后
      const fee = xwaifuAmount * 5n / 1000n;
      const amountToLock = xwaifuAmount - fee;

      await xwaifuContract.connect(user1).approve(await warehouse.getAddress(), xwaifuAmount);
      await warehouse.connect(user1).createTokenLockup(XLAYER_XWAIFU, xwaifuAmount, unlockTime);

      // 验证锁仓
      const lockup = await warehouse.tokenLockups(0);
      expect(lockup.user).to.equal(user1.address);
      expect(lockup.tokenAddress).to.equal(XLAYER_XWAIFU);
      expect(lockup.amountLocked).to.equal(amountToLock);
      expect(lockup.unlockTime).to.equal(unlockTime);
    });

    it("应该能够使用xwaifu优惠创建存款(基础费用半价)", async function () {
      // 1. 先创建xwaifu锁仓
      const xwaifuAmount = ethers.parseEther("10000");
      const unlockTime = (await time.latest()) + (365 * 86400);
      const xwaifuFee = xwaifuAmount * 5n / 1000n;
      const xwaifuLocked = xwaifuAmount - xwaifuFee;

      await xwaifuContract.connect(user1).approve(await warehouse.getAddress(), xwaifuAmount);
      await warehouse.connect(user1).createTokenLockup(XLAYER_XWAIFU, xwaifuAmount, unlockTime);

      // 2. 创建U本位存款并使用优惠
      const amountPerPeriod = 100n * 10n ** 6n;
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n; // 0.5%
      const discountedBaseFee = baseFee / 2n; // 半价
      const protocolFee = 10000n * BigInt(totalPeriods);
      const totalFee = discountedBaseFee + protocolFee;
      const xwaifuDiscountCost = ethers.parseEther("100"); // 100 xwaifu

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalAmount + totalFee);

      const ownerUsdtBefore = await usdtContract.balanceOf(owner.address);
      const ownerXwaifuBefore = await xwaifuContract.balanceOf(owner.address);

      // 使用锁仓ID 0 来获取优惠
      await warehouse.connect(user1).createDeposit(amountPerPeriod, 86400, totalPeriods, 0);

      // 验证费用
      const ownerUsdtAfter = await usdtContract.balanceOf(owner.address);
      const ownerXwaifuAfter = await xwaifuContract.balanceOf(owner.address);
      
      expect(ownerUsdtAfter - ownerUsdtBefore).to.equal(totalFee);
      expect(ownerXwaifuAfter - ownerXwaifuBefore).to.equal(xwaifuDiscountCost);

      // 验证锁仓金额减少
      const lockup = await warehouse.tokenLockups(0);
      expect(lockup.amountLocked).to.equal(xwaifuLocked - xwaifuDiscountCost);
    });

    it("应该拒绝使用不符合条件的锁仓ID", async function () {
      // 创建金额不足的锁仓
      const insufficientAmount = ethers.parseEther("5000"); // 只有5000，不足10000
      const unlockTime = (await time.latest()) + (365 * 86400);
      const fee = insufficientAmount * 5n / 1000n;

      await xwaifuContract.connect(user1).approve(await warehouse.getAddress(), insufficientAmount);
      await warehouse.connect(user1).createTokenLockup(XLAYER_XWAIFU, insufficientAmount, unlockTime);

      // 尝试使用优惠
      const amountPerPeriod = 100n * 10n ** 6n;
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = 10000n * BigInt(totalPeriods);
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);

      await expect(
        warehouse.connect(user1).createDeposit(amountPerPeriod, 86400, totalPeriods, 0)
      ).to.be.revertedWith("Stake amount too low");
    });

    it("应该拒绝使用锁仓时间不足的锁仓ID", async function () {
      // 创建时间不足的锁仓 (只锁30天)
      const xwaifuAmount = ethers.parseEther("10000");
      const shortUnlockTime = (await time.latest()) + (30 * 86400);
      const fee = xwaifuAmount * 5n / 1000n;

      await xwaifuContract.connect(user1).approve(await warehouse.getAddress(), xwaifuAmount);
      await warehouse.connect(user1).createTokenLockup(XLAYER_XWAIFU, xwaifuAmount, shortUnlockTime);

      // 尝试使用优惠
      const amountPerPeriod = 100n * 10n ** 6n;
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = 10000n * BigInt(totalPeriods);
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);

      await expect(
        warehouse.connect(user1).createDeposit(amountPerPeriod, 86400, totalPeriods, 0)
      ).to.be.revertedWith("Stake duration too short");
    });

    it("应该拒绝使用别人的锁仓ID", async function () {
      // user2创建锁仓
      const xwaifuAmount = ethers.parseEther("10000");
      const unlockTime = (await time.latest()) + (365 * 86400);

      await xwaifuContract.connect(user2).approve(await warehouse.getAddress(), xwaifuAmount);
      await warehouse.connect(user2).createTokenLockup(XLAYER_XWAIFU, xwaifuAmount, unlockTime);

      // user1尝试使用user2的锁仓
      const amountPerPeriod = 100n * 10n ** 6n;
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = 10000n * BigInt(totalPeriods);
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);

      await expect(
        warehouse.connect(user1).createDeposit(amountPerPeriod, 86400, totalPeriods, 0)
      ).to.be.revertedWith("Not your lockup");
    });

    it("应该拒绝使用已提取的锁仓ID", async function () {
      // 创建并提取锁仓
      const xwaifuAmount = ethers.parseEther("10000");
      const unlockTime = (await time.latest()) + 3600;

      await xwaifuContract.connect(user1).approve(await warehouse.getAddress(), xwaifuAmount);
      await warehouse.connect(user1).createTokenLockup(XLAYER_XWAIFU, xwaifuAmount, unlockTime);

      await time.increaseTo(unlockTime);
      await warehouse.connect(user1).withdrawTokenLockup(0);

      // 尝试使用已提取的锁仓
      const amountPerPeriod = 100n * 10n ** 6n;
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = 10000n * BigInt(totalPeriods);
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);

      await expect(
        warehouse.connect(user1).createDeposit(amountPerPeriod, 86400, totalPeriods, 0)
      ).to.be.revertedWith("Lockup withdrawn");
    });

    it("应该拒绝使用非xwaifu代币的锁仓ID", async function () {
      // 使用USDT创建锁仓
      const usdtAmount = 1000n * 10n ** 6n;
      const unlockTime = (await time.latest()) + (365 * 86400);

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), usdtAmount);
      await warehouse.connect(user1).createTokenLockup(XLAYER_USDT, usdtAmount, unlockTime);

      // 尝试使用USDT锁仓获取优惠
      const amountPerPeriod = 100n * 10n ** 6n;
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = 10000n * BigInt(totalPeriods);
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);

      await expect(
        warehouse.connect(user1).createDeposit(amountPerPeriod, 86400, totalPeriods, 0)
      ).to.be.revertedWith("Not xwaifu lockup");
    });
  });

  describe("币本位锁仓", function () {
    it("应该能够锁定任意ERC20代币", async function () {
      const lockAmount = 500n * 10n ** 6n; // 500 USDT
      const unlockTime = (await time.latest()) + 86400 * 30;
      const fee = lockAmount * 5n / 1000n;
      const amountToLock = lockAmount - fee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), lockAmount);
      await warehouse.connect(user1).createTokenLockup(XLAYER_USDT, lockAmount, unlockTime);

      const lockup = await warehouse.tokenLockups(0);
      expect(lockup.amountLocked).to.equal(amountToLock);
      expect(lockup.tokenAddress).to.equal(XLAYER_USDT);
    });

    it("应该能够锁定原生OKB代币", async function () {
      const lockAmount = ethers.parseEther("1"); // 1 OKB
      const unlockTime = (await time.latest()) + 86400 * 30;
      const fee = lockAmount * 5n / 1000n;
      const amountToLock = lockAmount - fee;

      await warehouse.connect(user1).createTokenLockup(ethers.ZeroAddress, 0, unlockTime, { value: lockAmount });

      const lockup = await warehouse.tokenLockups(0);
      expect(lockup.amountLocked).to.equal(amountToLock);
      expect(lockup.tokenAddress).to.equal(ethers.ZeroAddress);
    });
  });

  describe("精度处理", function () {
    it("应该正确处理6位精度的USDT", async function () {
      const amountPerPeriod = 5n * 10n ** 6n; // 最小金额 5 USDT
      const totalPeriods = 10;
      const totalAmount = amountPerPeriod * BigInt(totalPeriods);
      const baseFee = totalAmount * 50n / 10000n;
      const protocolFee = 10000n * BigInt(totalPeriods); // 0.01 * 10
      const totalToTransfer = totalAmount + baseFee + protocolFee;

      await usdtContract.connect(user1).approve(await warehouse.getAddress(), totalToTransfer);
      await warehouse.connect(user1).createDeposit(amountPerPeriod, 3600, totalPeriods, 0);

      const deposit = await warehouse.deposits(0);
      expect(deposit.totalAmount).to.equal(totalAmount);
      expect(deposit.amountPerPeriod).to.equal(amountPerPeriod);
    });
  });
});
