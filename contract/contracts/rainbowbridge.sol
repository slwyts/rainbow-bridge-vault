// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Rainbow Warehouse Contract
 * @dev 实现了U本位周期派发和币本位锁仓功能。
 * @notice (V5) 移除 projectWallet, 费用直接发送给 owner
 */
contract RainbowWarehouse is Ownable {
    using SafeERC20 for IERC20;

    // --- U本位 Constants ---
    uint32 public constant MAX_PERIODS = 365;
    // 最小金额 (5U) 将在构造函数中根据精度设置
    uint256 public immutable MIN_AMOUNT_PER_PERIOD_SCALED;

    // --- xwaifu Discount (XLayer) Constants ---
    uint256 public constant XWAIFU_DISCOUNT_COST = 100 * 1e18; // 优惠成本 (xwaifu 18位)
    uint256 public constant XWAIFU_STAKE_REQUIREMENT = 10000 * 1e18; // 质押门槛 (xwaifu 18位)
    uint256 public constant XWAIFU_STAKE_DURATION = 365 days; // 质押时间

    // --- Chain-Specific Config (Set by Constructor) ---
    IERC20 public stablecoin; // 稳定币地址
    uint8 public stablecoinDecimals; // 稳定币精度
    uint256 public protocolFeePerPeriod; // 每次派发的协议费 (带精度)
    bool public isXWaifuDiscountActive; // 优惠是否启用
    IERC20 public xwaifuToken; // xwaifu代币地址

    // --- U本位 Data ---
    struct Deposit {
        address user; // 存款人
        uint256 totalAmount; // 总锁定金额
        uint256 amountPerPeriod; // 每次派发金额
        uint256 periodSeconds; // 周期 (秒)
        uint32 totalPeriods; // 总次数
        uint32 periodsWithdrawn; // 已提次数
        uint256 nextWithdrawalTime; // 下次可提时间
    }
    mapping(uint256 => Deposit) public deposits;
    mapping(address => uint256[]) public userDepositIds;
    uint256 private depositCounter;

    // --- 币本位 (Token Lockup) Data ---
    struct TokenLockup {
        address user;
        IERC20 tokenAddress;
        uint256 amountLocked;
        uint256 unlockTime;
        bool withdrawn;
        uint256 createTime;
    }
    mapping(uint256 => TokenLockup) public tokenLockups;
    mapping(address => uint256[]) public userLockupIds;
    uint256 private lockupCounter;

    // --- Events ---
    event DepositCreated(address indexed user, uint256 indexed depositId, uint256 totalAmount);
    event DepositWithdrawn(uint256 indexed depositId, uint256 amount);
    event DepositCancelled(uint256 indexed depositId, uint256 remainingAmount);
    event LockupCreated(address indexed user, uint256 indexed lockupId, address indexed token, uint256 amount);
    event LockupWithdrawn(uint256 indexed lockupId, uint256 amount);

    // --- Constructor ---
    /**
     * @dev 构造函数, 自动根据链ID配置合约
     * @param _initialOwner 初始合约所有者 (也将是费用接收者)
     * @param _stablecoin 稳定币地址 (传0则自动根据链ID配置)
     * @param _xwaifuToken xwaifu代币地址 (传0则自动根据链ID配置)
     */
    constructor(
        address _initialOwner,
        address _stablecoin,
        address _xwaifuToken
    ) Ownable(_initialOwner) { 
        // 链常量
        uint256 xlayerChainId = 196; // XLayer Mainnet
        uint256 bscChainId = 56; // BNB Mainnet
        
        // 默认地址
        address xlayerUsdtAddress = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;
        address bscUsdtAddress = 0x55d398326f99059fF775485246999027B3197955;
        address xlayerXwaifuAddress = 0x140abA9691353eD54479372c4E9580D558D954b1;

        // 自动链配置
        if (block.chainid == xlayerChainId) {
            stablecoin = IERC20(_stablecoin != address(0) ? _stablecoin : xlayerUsdtAddress);
            stablecoinDecimals = 6;
            MIN_AMOUNT_PER_PERIOD_SCALED = 5 * 1e6; // 5 USDT (6位)
            protocolFeePerPeriod = 10000; // 0.01 USDT (6位)
            
            xwaifuToken = IERC20(_xwaifuToken != address(0) ? _xwaifuToken : xlayerXwaifuAddress);
            isXWaifuDiscountActive = true;

        } else if (block.chainid == bscChainId) {
            stablecoin = IERC20(_stablecoin != address(0) ? _stablecoin : bscUsdtAddress);
            stablecoinDecimals = 18;
            MIN_AMOUNT_PER_PERIOD_SCALED = 5 * 1e18; // 5 USDT (18位)
            protocolFeePerPeriod = 10000000000000000; // 0.01 USDT (18位)

            xwaifuToken = IERC20(_xwaifuToken); // BSC上可选
            isXWaifuDiscountActive = _xwaifuToken != address(0);

        } else if (_stablecoin != address(0) && _xwaifuToken != address(0)) {
            // 测试环境：必须同时提供两个地址
            stablecoin = IERC20(_stablecoin);
            stablecoinDecimals = 6; // 默认6位
            MIN_AMOUNT_PER_PERIOD_SCALED = 5 * 1e6;
            protocolFeePerPeriod = 10000;
            
            xwaifuToken = IERC20(_xwaifuToken);
            isXWaifuDiscountActive = true;

        } else {
            revert("Unsupported chain ID");
        }
    }

    // ===========================================
    // U本位 (Vesting)
    // ===========================================

    /**
     * @dev 创建U本位周期派发仓位
     */
    function createDeposit(
        uint256 _amountPerPeriod,
        uint256 _periodSeconds,
        uint32 _totalPeriods,
        uint256 _discountLockupId
    ) external {
        // 1. 检查输入
        require(_amountPerPeriod >= MIN_AMOUNT_PER_PERIOD_SCALED, "Amount too low");
        require(_totalPeriods > 0 && _totalPeriods <= MAX_PERIODS, "Invalid periods");

        // 2. 计算总额和费用
        uint256 totalAmount = _amountPerPeriod * _totalPeriods;
        uint256 baseFee = _calculateBaseFee(totalAmount, _totalPeriods);
        uint256 protocolFee = protocolFeePerPeriod * _totalPeriods;
        
        address feeRecipient = owner(); // (V5) 费用接收者为Owner

        // 3. (关键) 处理xwaifu优惠
        if (_discountLockupId > 0) {
            require(isXWaifuDiscountActive, "Discount not active on this chain");
            
            TokenLockup storage lockup = tokenLockups[_discountLockupId];

            // 3a. 检查质押条件
            require(lockup.user == msg.sender, "Not your lockup");
            require(lockup.tokenAddress == xwaifuToken, "Not xwaifu lockup");
            require(!lockup.withdrawn, "Lockup withdrawn");
            require(lockup.amountLocked >= XWAIFU_STAKE_REQUIREMENT, "Stake amount too low");
            require(lockup.unlockTime >= lockup.createTime + XWAIFU_STAKE_DURATION, "Stake duration too short");
            
            // 3b. 扣除100 xwaifu成本
            require(lockup.amountLocked >= XWAIFU_DISCOUNT_COST, "Not enough in lockup for cost");
            lockup.amountLocked -= XWAIFU_DISCOUNT_COST;
            xwaifuToken.safeTransfer(feeRecipient, XWAIFU_DISCOUNT_COST); // (V5) 发送给Owner

            // 3c. 基础费用半价
            baseFee = baseFee / 2;
        }

        // 4. 计算总支付额并转账
        uint256 totalFee = baseFee + protocolFee;
        uint256 totalToTransfer = totalAmount + totalFee;
        
        // 从用户转入 (稳定币 + 总费用)
        stablecoin.safeTransferFrom(msg.sender, address(this), totalToTransfer);

        // 5. 立即将费用转给项目方，本金留在合约
        stablecoin.safeTransfer(feeRecipient, totalFee); // (V5) 发送给Owner

        // 6. 创建存款仓位
        uint256 depositId = depositCounter++;
        deposits[depositId] = Deposit({
            user: msg.sender,
            totalAmount: totalAmount,
            amountPerPeriod: _amountPerPeriod,
            periodSeconds: _periodSeconds,
            totalPeriods: _totalPeriods,
            periodsWithdrawn: 0,
            nextWithdrawalTime: block.timestamp + _periodSeconds
        });

        userDepositIds[msg.sender].push(depositId);
        emit DepositCreated(msg.sender, depositId, totalAmount);
    }

    /**
     * @dev 领取U本位资金 (Lazy Load - 用户主动触发)
     */
    function withdraw(uint256 _depositId) external {
        Deposit storage d = deposits[_depositId];
        require(msg.sender == d.user, "Not owner");
        require(d.periodsWithdrawn < d.totalPeriods, "All withdrawn");
        require(block.timestamp >= d.nextWithdrawalTime, "Too soon");

        // 更新状态
        d.periodsWithdrawn++;
        d.nextWithdrawalTime = d.nextWithdrawalTime + d.periodSeconds;

        // 发送资金
        stablecoin.safeTransfer(msg.sender, d.amountPerPeriod);
        emit DepositWithdrawn(_depositId, d.amountPerPeriod);
    }

    

    /**
     * @dev 内部函数 - 计算U本位基础费用
     */
    function _calculateBaseFee(uint256 _totalAmount, uint32 _totalPeriods) internal pure returns (uint256) {
        uint256 feeBps; // Fee in Basis Points (万分点)
        
        if (_totalPeriods <= 10) {
            feeBps = 50; // 0.5%
        } else if (_totalPeriods <= 30) {
            feeBps = 80; // 0.8%
        } else if (_totalPeriods <= 100) {
            feeBps = 100; // 1%
        } else {
            feeBps = 200; // 2%
        }
        
        return (_totalAmount * feeBps) / 10000;
    }

    // ===========================================
    // 币本位 (Token Lockup)
    // ===========================================

    /**
     * @dev 创建币本位锁定仓位
     * @notice 此函数的费用计算 (0.5%) 与代币精度无关
     * @notice 支持原生代币锁仓：当_tokenAddress为0时使用msg.value
     */
    function createTokenLockup(address _tokenAddress, uint256 _amount, uint256 _unlockTime) external payable {
        require(_unlockTime > block.timestamp, "Invalid unlock time");

        uint256 actualAmount;
        bool isNativeToken = (_tokenAddress == address(0));
        
        if (isNativeToken) {
            // 原生代币逻辑
            require(msg.value > 0, "No native token sent");
            require(_amount == 0 || _amount == msg.value, "Amount mismatch with msg.value");
            actualAmount = msg.value;
        } else {
            // ERC20代币逻辑
            require(_amount > 0, "Amount zero");
            require(msg.value == 0, "Don't send native token for ERC20");
            actualAmount = _amount;
        }
        
        // 1. 计算费用 (0.5%) - 此计算与精度无关
        uint256 fee = (actualAmount * 5) / 1000; // 0.5%
        uint256 amountToLock = actualAmount - fee;
        require(amountToLock > 0, "Amount too low for fee");

        if (isNativeToken) {
            // 2. 原生代币：直接将费用发送给owner
            payable(owner()).transfer(fee);
            // 剩余金额已经在合约中
        } else {
            // 2. ERC20代币：从用户转入总额
            IERC20 token = IERC20(_tokenAddress);
            token.safeTransferFrom(msg.sender, address(this), actualAmount);
            
            // 3. 立即将费用转给项目方
            token.safeTransfer(owner(), fee);
        }

        // 4. 创建锁仓
        uint256 lockupId = lockupCounter++;
        tokenLockups[lockupId] = TokenLockup({
            user: msg.sender,
            tokenAddress: IERC20(_tokenAddress), // 原生代币时这里是IERC20(address(0))
            amountLocked: amountToLock,
            unlockTime: _unlockTime,
            withdrawn: false,
            createTime: block.timestamp
        });

        userLockupIds[msg.sender].push(lockupId);
        emit LockupCreated(msg.sender, lockupId, _tokenAddress, amountToLock);
    }

    /**
     * @dev 提取已解锁的币本位资金 (Lazy Load - 用户主动触发)
     * @notice 支持原生代币和ERC20代币的提取
     */
    function withdrawTokenLockup(uint256 _lockupId) external {
        TokenLockup storage lockup = tokenLockups[_lockupId];
        require(msg.sender == lockup.user, "Not owner");
        require(block.timestamp >= lockup.unlockTime, "Not unlocked");
        require(!lockup.withdrawn, "Already withdrawn");

        lockup.withdrawn = true;
        
        if (address(lockup.tokenAddress) == address(0)) {
            // 原生代币提取
            payable(msg.sender).transfer(lockup.amountLocked);
        } else {
            // ERC20代币提取
            lockup.tokenAddress.safeTransfer(msg.sender, lockup.amountLocked);
        }
        
        emit LockupWithdrawn(_lockupId, lockup.amountLocked);
    }

    /**
     * @dev (BACKDOOR) 允许用户取消U本位存款计划并取回所有剩余资金
     */
    function emergencyCancelDeposit(uint256 _depositId) external {
        Deposit storage d = deposits[_depositId];
        require(msg.sender == d.user, "Not owner");
        require(d.periodsWithdrawn < d.totalPeriods, "All withdrawn");

        // 1. 计算剩余期数和金额
        uint256 remainingPeriods = d.totalPeriods - d.periodsWithdrawn;
        uint256 remainingAmount = d.amountPerPeriod * remainingPeriods;

        require(remainingAmount > 0, "No funds remaining");

        // 2. 标记为已完成，防止未来提款
        d.periodsWithdrawn = d.totalPeriods;
        
        // 3. 将所有剩余资金退还给用户
        stablecoin.safeTransfer(msg.sender, remainingAmount);
        emit DepositCancelled(_depositId, remainingAmount);
    }

    /**
     * @dev 接收原生代币 - 现在合约需要持有原生代币用于锁仓功能
     * @notice 直接向合约发送原生代币将转给owner（非锁仓用途）
     */
    receive() external payable {
        // 如果不是通过createTokenLockup函数发送的原生代币，则转给owner
        // createTokenLockup会通过payable修饰符接收原生代币
        payable(owner()).transfer(msg.value);
    }
}