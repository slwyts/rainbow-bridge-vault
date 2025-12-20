// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RainbowWarehouse is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Configuration ---
    IERC20 public immutable xwaifuToken;
    IERC20 public immutable usdtToken;
    uint256 public immutable REMITTANCE_FEE; // 0.1 USDT (decimals based)
    
    // Discount Config
    uint256 public constant DISCOUNT_COST = 100 * 1e18;
    uint256 public constant STAKE_MIN_AMOUNT = 9800 * 1e18; // Adjusted to allow for fee + cost deduction
    uint256 public constant STAKE_MIN_DURATION = 365 days;
    
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
        bool remittanceEnabled;
        bool createdAsRemit;
    }

    struct Lockup {
        address user;
        address token;         // address(0) for native
        uint256 amount;
        uint256 unlockTime;
        bool withdrawn;
        bool isDiscountActive; // VIP Status
        uint256 createTime;
        bool remittanceEnabled;
        bool createdAsRemit;
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
    event DepositWithdrawn(uint256 indexed id, uint256 amount, address to);
    event DepositCancelled(uint256 indexed id, uint256 returnedAmount);
    event LockupCreated(uint256 indexed id, address indexed user, address token, uint256 amount);
    event LockupWithdrawn(uint256 indexed id, uint256 amount, address to);
    event DepositRemittanceEnabled(uint256 indexed id);
    event LockupRemittanceEnabled(uint256 indexed id);

    constructor(address _initialOwner, address _xwaifuToken, address _usdtToken) Ownable(_initialOwner) {
        address resolvedXwaifu = address(0);
        address resolvedUsdt = address(0);

        if (block.chainid == 196) {
            // XLayer: require explicit USDT address from constructor for safety
            require(_usdtToken != address(0), "USDT required on XLayer");
            resolvedXwaifu = XWAIFU_ADDRESS;
            resolvedUsdt = _usdtToken;
        } else if (block.chainid == 42161) {
            // Default Arbitrum USDT; allow override
            address defaultUsdt = 0xfd086BC7Cd5C481dcc9C85eb1428Fa16A85c9AED;
            resolvedUsdt = _usdtToken != address(0) ? _usdtToken : defaultUsdt;
        } else if (block.chainid == 56) {
            // Default BSC USDT; allow override
            address defaultUsdt = 0x55d398326f99059fF775485246999027B3197955;
            resolvedUsdt = _usdtToken != address(0) ? _usdtToken : defaultUsdt;
        } else if (block.chainid == 31337) {
            resolvedXwaifu = _xwaifuToken;
            address defaultUsdt = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
            resolvedUsdt = _usdtToken != address(0) ? _usdtToken : defaultUsdt;
        } else {
            revert("Unsupported chain");
        }

        // Optional xwaifu override (for test/local)
        if (_xwaifuToken != address(0) && resolvedXwaifu == address(0)) {
            resolvedXwaifu = _xwaifuToken;
        }

        require(resolvedUsdt != address(0), "USDT not set");

        xwaifuToken = IERC20(resolvedXwaifu);
        usdtToken = IERC20(resolvedUsdt);

        uint8 decimals = 18;
        try IERC20Metadata(resolvedUsdt).decimals() returns (uint8 dec) {
            decimals = dec;
        } catch {
            decimals = 18;
        }
        REMITTANCE_FEE = (10 ** decimals) / 10; // 0.1 USDT
    }

    // --- Vesting (Periodic) ---
    function createDeposit(
        address _token,
        uint256 _amountPerPeriod,
        uint256 _periodSeconds,
        uint32 _totalPeriods,
        uint256 _discountLockupId,
        bool _enableRemittance
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
                (bool okFee, ) = payable(owner()).call{value: fee}("");
                require(okFee, "Fee transfer failed");
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
            nextWithdrawalTime: block.timestamp + _periodSeconds,
            remittanceEnabled: _enableRemittance,
            createdAsRemit: _enableRemittance
        });
        
        userDepositIds[msg.sender].push(id);
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

        // How many periods are available since nextWithdrawalTime
        uint256 remaining = d.totalPeriods - d.periodsWithdrawn;
        uint256 available = 1 + (block.timestamp - d.nextWithdrawalTime) / d.periodSeconds; // at least 1
        if (available > remaining) {
            available = remaining; // cap to remaining
        }

        // Update state
        d.periodsWithdrawn += uint32(available);
        if (d.periodsWithdrawn < d.totalPeriods) {
            d.nextWithdrawalTime += d.periodSeconds * available;
        }

        // Payout all available periods at once
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
    // Only native remittance (created at open) can be emergency cancelled
    require(d.createdAsRemit, "Cancel not allowed");

        uint256 remaining = d.amountPerPeriod * (d.totalPeriods - d.periodsWithdrawn);
        d.periodsWithdrawn = d.totalPeriods; // Mark complete

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
    // Only native remittance (created at open) can be emergency cancelled
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

    // --- Lockup (One-time) ---
    function createLockup(address _token, uint256 _amount, uint256 _unlockTime, bool _enableRemittance) external payable nonReentrant {
        require(_unlockTime > block.timestamp, "Invalid time");
        
        uint256 amountLocked = _amount;
        uint256 fee = 0;

        if (_token == address(0)) {
            require(msg.value > 0, "No value");
            amountLocked = msg.value;
            fee = (amountLocked * 5) / 1000; // 0.5%
            amountLocked -= fee;
            
            (bool okFee, ) = payable(owner()).call{value: fee}("");
            require(okFee, "Fee transfer failed");
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
            createTime: block.timestamp,
            remittanceEnabled: _enableRemittance,
            createdAsRemit: _enableRemittance
        });

        userLockupIds[msg.sender].push(id);
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

    // --- Remittance Enable (Warehouse -> Remit) ---
    function enableDepositRemittance(uint256 _id) external nonReentrant {
        Deposit storage d = deposits[_id];
        require(msg.sender == d.user, "Not owner");
        require(!d.remittanceEnabled, "Already remit");
        require(d.periodsWithdrawn < d.totalPeriods, "Completed");

        _collectRemittanceFee();

        d.remittanceEnabled = true;
        d.createdAsRemit = false; // conversion
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
    
    receive() external payable {
        (bool ok, ) = payable(owner()).call{value: msg.value}("");
        require(ok, "Native transfer failed");
    }
}