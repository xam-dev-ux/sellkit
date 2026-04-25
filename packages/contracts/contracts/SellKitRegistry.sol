// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SellKitRegistry
 * @notice Registers sellers and their x402 services, processes USDC payments with
 *         automatic fee split and onchain free-tier tracking.
 */
contract SellKitRegistry is Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────

    struct SellerRecord {
        address sellerAddress;
        address walletAddress;
        string basename;
        uint256 registeredAt;
        bool active;
        uint16 feeOverride; // basis points; 0 = use global fee
    }

    struct ServiceRecord {
        bytes32 serviceId;
        address seller;
        string name;
        string description;
        string endpoint;
        string skillFileUrl;
        uint256 priceUsdc;
        uint8 category;
        uint256 erc8004TokenId;
        bool active;
        uint256 createdAt;
        uint256 totalCalls;
        uint256 totalRevenueUsdc;
    }

    struct FreeTierRecord {
        address seller;
        uint256 txCount;
        uint256 periodStart;
        uint256 limit;
    }

    struct PaymentRecord {
        bytes32 txHash;
        address buyer;
        address seller;
        bytes32 serviceId;
        uint256 grossAmount;
        uint256 sellerAmount;
        uint256 feeAmount;
        uint16 feePercent;
        bool wasFreeTier;
        uint256 timestamp;
    }

    struct FeeConfig {
        uint16 globalFeePercent; // basis points; 500 = 5 %
        uint256 freeTierLimit;
        address treasury;
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    IERC20 public immutable usdc;
    FeeConfig public feeConfig;

    mapping(address => SellerRecord) private _sellers;
    mapping(bytes32 => ServiceRecord) private _services;
    mapping(address => bytes32[]) private _sellerServiceIds;
    mapping(address => FreeTierRecord) private _freeTiers;
    mapping(bytes32 => PaymentRecord) private _payments;

    // Global counters
    uint256 public totalSellers;
    uint256 public totalServices;
    uint256 public totalTransactions;
    uint256 public totalVolume;
    uint256 public totalFeesCollected;

    address[] private _sellerAddresses;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event SellerRegistered(address indexed seller, address walletAddress, string basename, uint256 timestamp);
    event WalletUpdated(address indexed seller, address oldWallet, address newWallet);
    event ServiceCreated(address indexed seller, bytes32 indexed serviceId, string name, uint256 priceUsdc, uint8 category);
    event ServiceUpdated(bytes32 indexed serviceId, string endpoint, uint256 newPrice);
    event ServiceDeactivated(bytes32 indexed serviceId);
    event PaymentProcessed(
        address indexed buyer,
        address indexed seller,
        bytes32 indexed serviceId,
        uint256 grossAmount,
        uint256 sellerAmount,
        uint256 feeAmount,
        bool wasFreeTier
    );
    event FreeTierReset(address indexed seller, uint256 newPeriodStart);
    event FeeUpdated(uint16 oldFee, uint16 newFee);
    event FreeTierLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event SellerFeeOverrideSet(address indexed seller, uint16 feePercent);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event SellerDeactivated(address indexed seller);

    // ─────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────

    error NotRegistered();
    error AlreadyExists();
    error NotServiceOwner();
    error ServiceNotFound();
    error FeeTooHigh();
    error ZeroAddress();
    error InvalidPrice();
    error NotAuthorizedBackend();

    // ─────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────

    modifier onlyRegistered() {
        if (!_sellers[msg.sender].active) revert NotRegistered();
        _;
    }

    modifier onlyServiceOwner(bytes32 serviceId) {
        if (_services[serviceId].seller != msg.sender) revert NotServiceOwner();
        _;
    }

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor(
        address usdcAddress,
        address treasury,
        uint16 initialFeePercent,
        uint256 initialFreeTierLimit
    ) Ownable(msg.sender) {
        if (usdcAddress == address(0) || treasury == address(0)) revert ZeroAddress();
        if (initialFeePercent > 2000) revert FeeTooHigh();
        usdc = IERC20(usdcAddress);
        feeConfig = FeeConfig({
            globalFeePercent: initialFeePercent,
            freeTierLimit: initialFreeTierLimit,
            treasury: treasury
        });
    }

    // ─────────────────────────────────────────────
    // Write — Seller management
    // ─────────────────────────────────────────────

    function registerSeller(address walletAddress, string calldata basename) external whenNotPaused {
        if (walletAddress == address(0)) revert ZeroAddress();
        bool isNew = !_sellers[msg.sender].active && _sellers[msg.sender].registeredAt == 0;
        if (isNew) {
            _sellerAddresses.push(msg.sender);
            totalSellers++;
            _freeTiers[msg.sender] = FreeTierRecord({
                seller: msg.sender,
                txCount: 0,
                periodStart: block.timestamp,
                limit: feeConfig.freeTierLimit
            });
        }
        _sellers[msg.sender] = SellerRecord({
            sellerAddress: msg.sender,
            walletAddress: walletAddress,
            basename: basename,
            registeredAt: isNew ? block.timestamp : _sellers[msg.sender].registeredAt,
            active: true,
            feeOverride: _sellers[msg.sender].feeOverride
        });
        emit SellerRegistered(msg.sender, walletAddress, basename, block.timestamp);
    }

    function updateWallet(address newWallet) external onlyRegistered whenNotPaused {
        if (newWallet == address(0)) revert ZeroAddress();
        address old = _sellers[msg.sender].walletAddress;
        _sellers[msg.sender].walletAddress = newWallet;
        emit WalletUpdated(msg.sender, old, newWallet);
    }

    // ─────────────────────────────────────────────
    // Write — Service management
    // ─────────────────────────────────────────────

    function createService(
        bytes32 serviceId,
        string calldata name,
        string calldata description,
        string calldata endpoint,
        string calldata skillFileUrl,
        uint256 priceUsdc,
        uint8 category
    ) external onlyRegistered whenNotPaused {
        if (_services[serviceId].createdAt != 0) revert AlreadyExists();
        if (priceUsdc == 0) revert InvalidPrice();
        _services[serviceId] = ServiceRecord({
            serviceId: serviceId,
            seller: msg.sender,
            name: name,
            description: description,
            endpoint: endpoint,
            skillFileUrl: skillFileUrl,
            priceUsdc: priceUsdc,
            category: category,
            erc8004TokenId: 0,
            active: true,
            createdAt: block.timestamp,
            totalCalls: 0,
            totalRevenueUsdc: 0
        });
        _sellerServiceIds[msg.sender].push(serviceId);
        totalServices++;
        emit ServiceCreated(msg.sender, serviceId, name, priceUsdc, category);
    }

    function updateService(
        bytes32 serviceId,
        string calldata endpoint,
        string calldata skillFileUrl,
        uint256 newPrice
    ) external onlyServiceOwner(serviceId) whenNotPaused {
        if (newPrice == 0) revert InvalidPrice();
        ServiceRecord storage svc = _services[serviceId];
        svc.endpoint = endpoint;
        svc.skillFileUrl = skillFileUrl;
        svc.priceUsdc = newPrice;
        emit ServiceUpdated(serviceId, endpoint, newPrice);
    }

    function setErc8004TokenId(bytes32 serviceId, uint256 tokenId) external onlyOwner {
        _services[serviceId].erc8004TokenId = tokenId;
    }

    function deactivateService(bytes32 serviceId) external onlyServiceOwner(serviceId) whenNotPaused {
        _services[serviceId].active = false;
        totalServices = totalServices > 0 ? totalServices - 1 : 0;
        emit ServiceDeactivated(serviceId);
    }

    // ─────────────────────────────────────────────
    // Write — Payment processing
    // ─────────────────────────────────────────────

    /**
     * @notice Called by the SELLKIT backend operator when a buyer pays for a service.
     *         Transfers USDC from buyer, splits between seller and treasury, records payment.
     */
    function processPayment(bytes32 serviceId, address buyer) external onlyOwner whenNotPaused {
        ServiceRecord storage svc = _services[serviceId];
        if (svc.createdAt == 0 || !svc.active) revert ServiceNotFound();

        address seller = svc.seller;
        SellerRecord storage sellerRec = _sellers[seller];
        FreeTierRecord storage ft = _freeTiers[seller];

        uint256 gross = svc.priceUsdc;
        uint256 sellerAmount;
        uint256 feeAmount;
        uint16 appliedFee;
        bool wasFreeTier;

        if (ft.txCount < ft.limit) {
            sellerAmount = gross;
            feeAmount = 0;
            appliedFee = 0;
            wasFreeTier = true;
            ft.txCount++;
        } else {
            appliedFee = sellerRec.feeOverride > 0 ? sellerRec.feeOverride : feeConfig.globalFeePercent;
            feeAmount = (gross * appliedFee) / 10000;
            sellerAmount = gross - feeAmount;
            wasFreeTier = false;
        }

        // Pull USDC from buyer
        usdc.safeTransferFrom(buyer, address(this), gross);

        // Pay seller
        usdc.safeTransfer(sellerRec.walletAddress, sellerAmount);

        // Pay treasury
        if (feeAmount > 0) {
            usdc.safeTransfer(feeConfig.treasury, feeAmount);
            totalFeesCollected += feeAmount;
        }

        // Record
        bytes32 txId = keccak256(abi.encodePacked(buyer, serviceId, block.timestamp, block.number));
        _payments[txId] = PaymentRecord({
            txHash: txId,
            buyer: buyer,
            seller: seller,
            serviceId: serviceId,
            grossAmount: gross,
            sellerAmount: sellerAmount,
            feeAmount: feeAmount,
            feePercent: appliedFee,
            wasFreeTier: wasFreeTier,
            timestamp: block.timestamp
        });

        // Update service metrics
        svc.totalCalls++;
        svc.totalRevenueUsdc += sellerAmount;

        // Update globals
        totalTransactions++;
        totalVolume += gross;

        emit PaymentProcessed(buyer, seller, serviceId, gross, sellerAmount, feeAmount, wasFreeTier);
    }

    // ─────────────────────────────────────────────
    // Write — Owner admin
    // ─────────────────────────────────────────────

    function resetFreeTier(address seller) external onlyOwner {
        FreeTierRecord storage ft = _freeTiers[seller];
        ft.txCount = 0;
        ft.periodStart = block.timestamp;
        ft.limit = feeConfig.freeTierLimit;
        emit FreeTierReset(seller, block.timestamp);
    }

    function setGlobalFee(uint16 newFeePercent) external onlyOwner {
        if (newFeePercent > 2000) revert FeeTooHigh();
        uint16 old = feeConfig.globalFeePercent;
        feeConfig.globalFeePercent = newFeePercent;
        emit FeeUpdated(old, newFeePercent);
    }

    function setFreeTierLimit(uint256 newLimit) external onlyOwner {
        uint256 old = feeConfig.freeTierLimit;
        feeConfig.freeTierLimit = newLimit;
        emit FreeTierLimitUpdated(old, newLimit);
    }

    function setSellerFeeOverride(address seller, uint16 feePercent) external onlyOwner {
        if (feePercent > 2000) revert FeeTooHigh();
        _sellers[seller].feeOverride = feePercent;
        emit SellerFeeOverrideSet(seller, feePercent);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address old = feeConfig.treasury;
        feeConfig.treasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury);
    }

    function deactivateSeller(address seller) external onlyOwner {
        _sellers[seller].active = false;
        emit SellerDeactivated(seller);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────────────────────────
    // Read functions
    // ─────────────────────────────────────────────

    function getSeller(address seller) external view returns (SellerRecord memory) {
        return _sellers[seller];
    }

    function getService(bytes32 serviceId) external view returns (ServiceRecord memory) {
        return _services[serviceId];
    }

    function getSellerServices(address seller) external view returns (ServiceRecord[] memory) {
        bytes32[] memory ids = _sellerServiceIds[seller];
        ServiceRecord[] memory result = new ServiceRecord[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = _services[ids[i]];
        }
        return result;
    }

    function getFreeTierStatus(address seller)
        external
        view
        returns (uint256 used, uint256 limit, uint256 periodStart, bool isActive)
    {
        FreeTierRecord memory ft = _freeTiers[seller];
        return (ft.txCount, ft.limit, ft.periodStart, _sellers[seller].active);
    }

    function getPaymentRecord(bytes32 txHash) external view returns (PaymentRecord memory) {
        return _payments[txHash];
    }

    function getFeeConfig() external view returns (FeeConfig memory) {
        return feeConfig;
    }

    function calculateFee(address seller, uint256 amount)
        external
        view
        returns (uint256 sellerAmount, uint256 feeAmount, bool wasFreeTier)
    {
        FreeTierRecord memory ft = _freeTiers[seller];
        if (ft.txCount < ft.limit) {
            return (amount, 0, true);
        }
        SellerRecord memory s = _sellers[seller];
        uint16 fee = s.feeOverride > 0 ? s.feeOverride : feeConfig.globalFeePercent;
        uint256 fAmt = (amount * fee) / 10000;
        return (amount - fAmt, fAmt, false);
    }

    function isRegistered(address seller) external view returns (bool) {
        return _sellers[seller].active;
    }

    function getGlobalStats()
        external
        view
        returns (uint256 sellers, uint256 services, uint256 transactions, uint256 volume)
    {
        return (totalSellers, totalServices, totalTransactions, totalVolume);
    }

    function getAllSellerAddresses() external view returns (address[] memory) {
        return _sellerAddresses;
    }
}
