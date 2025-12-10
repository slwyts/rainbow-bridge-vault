// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RainbowWarehouse is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Configuration ---
    IERC20 public immutable xwaifuToken;
    
    // Discount Config
    uint256 public constant DISCOUNT_COST = 100 * 1e18;
    uint256 public constant STAKE_MIN_AMOUNT = 9800 * 1e18; // Adjusted to allow for fee + cost deduction
    uint256 public constant STAKE_MIN_DURATION = 365 days;
    
    uint256 public constant XLAYER_CHAIN_ID = 196;
    address public constant XWAIFU_ADDRESS = 0x140abA9691353eD54479372c4E9580D558D954b1;

    // --- State ---
    struct Deposit {
        address user;
        address token;          // Support different tokens (USDT, USDC, etc.) or native (address(0))
        uint256 amountPerPeriod;
        uint256 periodSeconds;
        uint32 totalPeriods;
        uint32 periodsWithdrawn;
        uint256 nextWithdrawalTime;
    }

    struct Lockup {
        address user;
        address token;         // address(0) for native
        uint256 amount;
        uint256 unlockTime;
        bool withdrawn;
        bool isDiscountActive; // VIP Status
        uint256 createTime;
    }

    mapping(uint256 => Deposit) public deposits;
    mapping(uint256 => Lockup) public lockups;
    
    // User indexes
    mapping(address => uint256[]) public userDepositIds;
    mapping(address => uint256[]) public userLockupIds;

    uint256 public nextDepositId;
    uint256 public nextLockupId;

    // --- Events ---
    event DepositCreated(uint256 indexed id, address indexed user, address token, uint256 totalAmount);
    event DepositWithdrawn(uint256 indexed id, uint256 amount);
    event DepositCancelled(uint256 indexed id, uint256 returnedAmount);
    event LockupCreated(uint256 indexed id, address indexed user, address token, uint256 amount);
    event LockupWithdrawn(uint256 indexed id, uint256 amount);

    constructor(address _initialOwner, address _xwaifuToken) Ownable(_initialOwner) {
        if (block.chainid == XLAYER_CHAIN_ID) {
            xwaifuToken = IERC20(0x140abA9691353eD54479372c4E9580D558D954b1);
        } else if (block.chainid == 31337) {
            xwaifuToken = IERC20(_xwaifuToken); // Allow testnet injection
        } else {
            xwaifuToken = IERC20(address(0)); // Disable on other chains
        }
    }

    // --- Vesting (Periodic) ---
    function createDeposit(
        address _token,
        uint256 _amountPerPeriod,
        uint256 _periodSeconds,
        uint32 _totalPeriods,
        uint256 _discountLockupId
    ) external payable nonReentrant {
        require(_totalPeriods > 0 && _totalPeriods <= 365, "Invalid periods");
        require(_amountPerPeriod > 0, "Amount > 0");

        uint256 totalPrincipal = _amountPerPeriod * _totalPeriods;
        uint256 fee = _calculateFee(totalPrincipal, _totalPeriods);

        // Handle Discount
        if (_discountLockupId > 0 && address(xwaifuToken) != address(0)) {
            if (_checkDiscount(_discountLockupId)) {
                fee = fee / 2;
            }
        }

        if (_token == address(0)) {
            require(msg.value == totalPrincipal + fee, "Incorrect value");
            if (fee > 0) {
                payable(owner()).transfer(fee);
            }
        } else {
            require(msg.value == 0, "No value needed");
            // Transfer tokens: Principal + Fee
            IERC20(_token).safeTransferFrom(msg.sender, address(this), totalPrincipal + fee);
            
            // Send fee to owner
            if (fee > 0) {
                IERC20(_token).safeTransfer(owner(), fee);
            }
        }

        // Store Deposit
        uint256 id = nextDepositId++;
        deposits[id] = Deposit({
            user: msg.sender,
            token: _token,
            amountPerPeriod: _amountPerPeriod,
            periodSeconds: _periodSeconds,
            totalPeriods: _totalPeriods,
            periodsWithdrawn: 0,
            nextWithdrawalTime: block.timestamp + _periodSeconds
        });
        
        userDepositIds[msg.sender].push(id);
        emit DepositCreated(id, msg.sender, _token, totalPrincipal);
    }

    function withdraw(uint256 _id) external nonReentrant {
        Deposit storage d = deposits[_id];
        require(msg.sender == d.user, "Not owner");
        require(d.periodsWithdrawn < d.totalPeriods, "Completed");
        require(block.timestamp >= d.nextWithdrawalTime, "Too soon");

        d.periodsWithdrawn++;
        d.nextWithdrawalTime += d.periodSeconds;

        if (d.token == address(0)) {
            payable(msg.sender).transfer(d.amountPerPeriod);
        } else {
            IERC20(d.token).safeTransfer(msg.sender, d.amountPerPeriod);
        }
        emit DepositWithdrawn(_id, d.amountPerPeriod);
    }

    function emergencyCancel(uint256 _id) external nonReentrant {
        Deposit storage d = deposits[_id];
        require(msg.sender == d.user, "Not owner");
        require(d.periodsWithdrawn < d.totalPeriods, "Completed");

        uint256 remaining = d.amountPerPeriod * (d.totalPeriods - d.periodsWithdrawn);
        d.periodsWithdrawn = d.totalPeriods; // Mark complete

        if (remaining > 0) {
            if (d.token == address(0)) {
                payable(msg.sender).transfer(remaining);
            } else {
                IERC20(d.token).safeTransfer(msg.sender, remaining);
            }
        }
        emit DepositCancelled(_id, remaining);
    }

    function emergencyCancelLockup(uint256 _id) external nonReentrant {
        Lockup storage l = lockups[_id];
        require(msg.sender == l.user, "Not owner");
        require(!l.withdrawn, "Withdrawn");

        l.withdrawn = true;

        if (l.token == address(0)) {
            payable(msg.sender).transfer(l.amount);
        } else {
            IERC20(l.token).safeTransfer(msg.sender, l.amount);
        }
        emit LockupWithdrawn(_id, l.amount);
    }

    // --- Lockup (One-time) ---
    function createLockup(address _token, uint256 _amount, uint256 _unlockTime) external payable nonReentrant {
        require(_unlockTime > block.timestamp, "Invalid time");
        
        uint256 amountLocked = _amount;
        uint256 fee = 0;

        if (_token == address(0)) {
            require(msg.value > 0, "No value");
            amountLocked = msg.value;
            fee = (amountLocked * 5) / 1000; // 0.5%
            amountLocked -= fee;
            
            payable(owner()).transfer(fee);
        } else {
            require(msg.value == 0, "No value needed");
            uint256 total = _amount;
            fee = (total * 5) / 1000; // 0.5%
            amountLocked = total - fee;

            IERC20(_token).safeTransferFrom(msg.sender, address(this), total);
            IERC20(_token).safeTransfer(owner(), fee);
        }

        uint256 id = nextLockupId++;
        lockups[id] = Lockup({
            user: msg.sender,
            token: _token,
            amount: amountLocked,
            unlockTime: _unlockTime,
            withdrawn: false,
            isDiscountActive: false,
            createTime: block.timestamp
        });

        userLockupIds[msg.sender].push(id);
        emit LockupCreated(id, msg.sender, _token, amountLocked);
    }

    function withdrawLockup(uint256 _id) external nonReentrant {
        Lockup storage l = lockups[_id];
        require(msg.sender == l.user, "Not owner");
        require(block.timestamp >= l.unlockTime, "Locked");
        require(!l.withdrawn, "Withdrawn");

        l.withdrawn = true;

        if (l.token == address(0)) {
            payable(msg.sender).transfer(l.amount);
        } else {
            IERC20(l.token).safeTransfer(msg.sender, l.amount);
        }
        emit LockupWithdrawn(_id, l.amount);
    }

    // --- Helpers ---
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
        
        // Check eligibility
        require(l.amount >= STAKE_MIN_AMOUNT, "Insufficient amount");
        require(l.unlockTime >= l.createTime + STAKE_MIN_DURATION, "Insufficient duration");

        // Burn cost from position
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
    
    receive() external payable {
        payable(owner()).transfer(msg.value);
    }
}