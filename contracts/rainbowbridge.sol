// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RainbowWarehouse is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable xwaifuToken;
    IERC20 public immutable usdtToken;
    uint256 public immutable REMITTANCE_FEE;
    uint256 public constant DISCOUNT_COST = 100 * 1e18;
    uint256 public constant STAKE_MIN_AMOUNT = 9800 * 1e18;
    uint256 public constant STAKE_MIN_DURATION = 363 days;

    struct Deposit {
        address user;
        address token;
        uint256 amountPerPeriod;
        uint256 periodSeconds;
        uint32 totalPeriods;
        uint32 periodsWithdrawn;
        uint256 nextWithdrawalTime;
        bool remittanceEnabled;
        bool createdAsRemit;
    }

    struct Lockup {
        address user;
        address token;
        uint256 amount;
        uint256 unlockTime;
        bool withdrawn;
        bool isDiscountActive;
        uint256 createTime;
        bool remittanceEnabled;
        bool createdAsRemit;
    }

    mapping(uint256 => Deposit) public deposits;
    mapping(uint256 => Lockup) public lockups;
    
    mapping(address => uint256[]) public userDepositIds;
    mapping(address => uint256[]) public userLockupIds;

    uint256 public nextDepositId;
    uint256 public nextLockupId;

    event DepositCreated(uint256 indexed id, address indexed user, address token, uint256 totalAmount);
    event DepositWithdrawn(uint256 indexed id, uint256 amount, address to);
    event DepositCancelled(uint256 indexed id, uint256 returnedAmount);
    event LockupCreated(uint256 indexed id, address indexed user, address token, uint256 amount);
    event LockupWithdrawn(uint256 indexed id, uint256 amount, address to);
    event DepositRemittanceEnabled(uint256 indexed id);
    event LockupRemittanceEnabled(uint256 indexed id);

    constructor(address _initialOwner, address _xwaifuToken, address _usdtToken) Ownable(_initialOwner) {
        (address xwaifu, address usdt) = _getTokenAddresses(_xwaifuToken, _usdtToken);
        xwaifuToken = IERC20(xwaifu);
        usdtToken = IERC20(usdt);

        uint8 decimals = IERC20Metadata(usdt).decimals();
        REMITTANCE_FEE = (10 ** decimals) / 10; // 0.1 USDT
    }

    function _getTokenAddresses(address _xwaifuToken, address _usdtToken) internal view returns (address xwaifu, address usdt) {
        if (block.chainid == 196) { // X Layer
            return (0x140abA9691353eD54479372c4E9580D558D954b1, 0x779Ded0c9e1022225f8E0630b35a9b54bE713736);
        } else if (block.chainid == 1) { // Ethereum
            return (address(0), 0xdAC17F958D2ee523a2206206994597C13D831ec7);
        } else if (block.chainid == 42161) { // Arbitrum
            return (address(0), 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9);
        } else if (block.chainid == 56) { // BSC
            return (address(0), 0x55d398326f99059fF775485246999027B3197955);
        } else if (block.chainid == 137) { // Polygon
            return (address(0), 0xc2132D05D31c914a87C6611C10748AEb04B58e8F);
        } else if (block.chainid == 8453) { // Base
            return (address(0), 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2);
        } else if (block.chainid == 31337) { // Hardhat Local
            address defaultUsdt = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
            return (_xwaifuToken, _usdtToken != address(0) ? _usdtToken : defaultUsdt);
        } else {
            revert("Unsupported chain");
        }
    }

    function createDeposit(
        address _token,
        uint256 _amountPerPeriod,
        uint256 _periodSeconds,
        uint32 _totalPeriods,
        uint256 _discountLockupId,
        bool _enableRemittance
    ) external payable nonReentrant whenNotPaused {
        require(_periodSeconds > 0, "Period must be > 0");
        require(_totalPeriods > 0 && _totalPeriods <= 365, "Invalid periods");
        require(_amountPerPeriod > 0, "Amount > 0");

        uint256 totalPrincipal = _amountPerPeriod * _totalPeriods;
        uint256 fee = _calculateFee(totalPrincipal, _totalPeriods);

        if (_discountLockupId != type(uint256).max && address(xwaifuToken) != address(0)) {
            if (_checkDiscount(_discountLockupId)) {
                fee = fee / 2;
            }
        }

        if (_token == address(0)) {
            require(msg.value == totalPrincipal + fee, "Incorrect value");
        } else {
            require(msg.value == 0, "No value needed");
        }

        // Effects - 先更新状态
        uint256 id = nextDepositId++;
        deposits[id] = Deposit({
            user: msg.sender,
            token: _token,
            amountPerPeriod: _amountPerPeriod,
            periodSeconds: _periodSeconds,
            totalPeriods: _totalPeriods,
            periodsWithdrawn: 0,
            nextWithdrawalTime: block.timestamp + _periodSeconds,
            remittanceEnabled: _enableRemittance,
            createdAsRemit: _enableRemittance
        });
        userDepositIds[msg.sender].push(id);

        // Interactions - 最后进行外部调用
        if (_token == address(0)) {
            if (fee > 0) {
                (bool okFee, ) = payable(owner()).call{value: fee}("");
                require(okFee, "Fee transfer failed");
            }
        } else {
            IERC20(_token).safeTransferFrom(msg.sender, address(this), totalPrincipal + fee);
            if (fee > 0) {
                IERC20(_token).safeTransfer(owner(), fee);
            }
        }

        emit DepositCreated(id, msg.sender, _token, totalPrincipal);
    }

    function withdraw(uint256 _id, address _to) external nonReentrant {
        Deposit storage d = deposits[_id];
        require(msg.sender == d.user, "Not owner");
        require(d.periodsWithdrawn < d.totalPeriods, "Completed");
        require(block.timestamp >= d.nextWithdrawalTime, "Too soon");

        address recipient = _to == address(0) ? msg.sender : _to;
        if (!d.remittanceEnabled) {
            require(recipient == msg.sender, "Remittance disabled");
        }

        uint256 remaining = d.totalPeriods - d.periodsWithdrawn;
        uint256 available = 1 + (block.timestamp - d.nextWithdrawalTime) / d.periodSeconds;
        if (available > remaining) {
            available = remaining;
        }

        d.periodsWithdrawn += uint32(available);
        if (d.periodsWithdrawn < d.totalPeriods) {
            d.nextWithdrawalTime += d.periodSeconds * available;
        }

        uint256 payout = d.amountPerPeriod * available;
        if (d.token == address(0)) {
            (bool ok, ) = payable(recipient).call{value: payout}("");
            require(ok, "Native transfer failed");
        } else {
            IERC20(d.token).safeTransfer(recipient, payout);
        }
        emit DepositWithdrawn(_id, payout, recipient);
    }

    function emergencyCancel(uint256 _id, address _to) external nonReentrant {
        Deposit storage d = deposits[_id];
        require(msg.sender == d.user, "Not owner");
        require(d.periodsWithdrawn < d.totalPeriods, "Completed");
        require(d.createdAsRemit, "Cancel not allowed");

        uint256 remaining = d.amountPerPeriod * (d.totalPeriods - d.periodsWithdrawn);
        d.periodsWithdrawn = d.totalPeriods;

        address recipient = _to == address(0) ? msg.sender : _to;
        require(recipient != address(0), "Invalid recipient");

        if (remaining > 0) {
            if (d.token == address(0)) {
                (bool ok, ) = payable(recipient).call{value: remaining}("");
                require(ok, "Native transfer failed");
            } else {
                IERC20(d.token).safeTransfer(recipient, remaining);
            }
        }
        emit DepositCancelled(_id, remaining);
    }

    function emergencyCancelLockup(uint256 _id, address _to) external nonReentrant {
        Lockup storage l = lockups[_id];
        require(msg.sender == l.user, "Not owner");
        require(!l.withdrawn, "Withdrawn");
        require(l.createdAsRemit, "Cancel not allowed");

        l.withdrawn = true;

        address recipient = _to == address(0) ? msg.sender : _to;
        require(recipient != address(0), "Invalid recipient");

        if (l.token == address(0)) {
            (bool ok, ) = payable(recipient).call{value: l.amount}("");
            require(ok, "Native transfer failed");
        } else {
            IERC20(l.token).safeTransfer(recipient, l.amount);
        }
        emit LockupWithdrawn(_id, l.amount, recipient);
    }

    function createLockup(address _token, uint256 _amount, uint256 _unlockTime, uint256 _discountLockupId, bool _enableRemittance) external payable nonReentrant whenNotPaused {
        // Checks
        require(_unlockTime > block.timestamp, "Invalid time");

        uint256 amountLocked = _amount;
        uint256 fee = 0;

        bool hasDiscount = false;
        if (_discountLockupId != type(uint256).max) {
            if (_checkDiscount(_discountLockupId)) {
                hasDiscount = true;
            }
        }

        if (_token == address(0)) {
            require(msg.value > 0, "No value");
            amountLocked = msg.value;
            fee = (amountLocked * 5) / 1000;
            if (hasDiscount) {
                fee = fee / 2;
            }
            amountLocked -= fee;
        } else {
            require(msg.value == 0, "No value needed");
            uint256 total = _amount;
            fee = (total * 5) / 1000;
            if (hasDiscount) {
                fee = fee / 2;
            }
            amountLocked = total - fee;
        }

        // Effects - 先更新状态
        uint256 id = nextLockupId++;
        lockups[id] = Lockup({
            user: msg.sender,
            token: _token,
            amount: amountLocked,
            unlockTime: _unlockTime,
            withdrawn: false,
            isDiscountActive: false,
            createTime: block.timestamp,
            remittanceEnabled: _enableRemittance,
            createdAsRemit: _enableRemittance
        });
        userLockupIds[msg.sender].push(id);

        // Interactions - 最后进行外部调用
        if (_token == address(0)) {
            (bool okFee, ) = payable(owner()).call{value: fee}("");
            require(okFee, "Fee transfer failed");
        } else {
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
            IERC20(_token).safeTransfer(owner(), fee);
        }

        emit LockupCreated(id, msg.sender, _token, amountLocked);
    }

    function withdrawLockup(uint256 _id, address _to) external nonReentrant {
        Lockup storage l = lockups[_id];
        require(msg.sender == l.user, "Not owner");
        require(block.timestamp >= l.unlockTime, "Locked");
        require(!l.withdrawn, "Withdrawn");

        l.withdrawn = true;

        address recipient = _to == address(0) ? msg.sender : _to;
        if (!l.remittanceEnabled) {
            require(recipient == msg.sender, "Remittance disabled");
        }

        if (l.token == address(0)) {
            (bool ok, ) = payable(recipient).call{value: l.amount}("");
            require(ok, "Native transfer failed");
        } else {
            IERC20(l.token).safeTransfer(recipient, l.amount);
        }
        emit LockupWithdrawn(_id, l.amount, recipient);
    }

    function _calculateFee(uint256 _amount, uint32 _periods) internal pure returns (uint256) {
        uint256 bps = _periods <= 10 ? 50 : (_periods <= 30 ? 80 : (_periods <= 100 ? 100 : 200));
        return (_amount * bps) / 10000;
    }

    function activateVIP(uint256 _lockupId) external nonReentrant {
        Lockup storage l = lockups[_lockupId];
        require(msg.sender == l.user, "Not owner");
        require(address(xwaifuToken) != address(0), "Not supported");
        require(l.token == address(xwaifuToken), "Not xWaifu");
        require(!l.withdrawn, "Withdrawn");
        require(!l.isDiscountActive, "Already active");
        
        require(l.amount >= STAKE_MIN_AMOUNT, "Insufficient amount");
        require(l.unlockTime >= l.createTime + STAKE_MIN_DURATION, "Insufficient duration");

        require(l.amount >= DISCOUNT_COST, "Cost too high");
        l.amount -= DISCOUNT_COST;
        xwaifuToken.safeTransfer(owner(), DISCOUNT_COST);
        
        l.isDiscountActive = true;
    }

    function _checkDiscount(uint256 _lockupId) internal view returns (bool) {
        Lockup storage l = lockups[_lockupId];
        if (l.user != msg.sender) return false;
        if (l.token != address(xwaifuToken)) return false;
        if (l.withdrawn) return false;
        if (!l.isDiscountActive) return false;
        if (l.amount < STAKE_MIN_AMOUNT) return false;
        if (l.unlockTime < l.createTime + STAKE_MIN_DURATION) return false;
        
        return true;
    }

    function enableDepositRemittance(uint256 _id) external nonReentrant {
        Deposit storage d = deposits[_id];
        require(msg.sender == d.user, "Not owner");
        require(!d.remittanceEnabled, "Already remit");
        require(d.periodsWithdrawn < d.totalPeriods, "Completed");

        _collectRemittanceFee();

        d.remittanceEnabled = true;
        d.createdAsRemit = false;
        emit DepositRemittanceEnabled(_id);
    }

    function enableLockupRemittance(uint256 _id) external nonReentrant {
        Lockup storage l = lockups[_id];
        require(msg.sender == l.user, "Not owner");
        require(!l.remittanceEnabled, "Already remit");
        require(!l.withdrawn, "Withdrawn");

        _collectRemittanceFee();

        l.remittanceEnabled = true;
        l.createdAsRemit = false;
        emit LockupRemittanceEnabled(_id);
    }

    function _collectRemittanceFee() internal {
        require(address(usdtToken) != address(0), "USDT not set");
        require(REMITTANCE_FEE > 0, "Fee disabled");
        usdtToken.safeTransferFrom(msg.sender, owner(), REMITTANCE_FEE);
    }
    
    receive() external payable nonReentrant {
        (bool ok, ) = payable(owner()).call{value: msg.value}("");
        require(ok, "Native transfer failed");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}