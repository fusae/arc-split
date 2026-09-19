// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title ArcSplit — immutable, single-payment splits using Arc's native USDC.
/// @notice Native USDC has 18 decimals. Orders and payouts use 6-decimal precision.
contract ArcSplit {
    uint256 public constant BPS = 10_000;
    uint256 public constant USDC_SCALE = 1e12;
    uint256 public constant MAX_RECIPIENTS = 5;
    uint256 public nextOrderId = 1;
    bool private entered;

    struct Order {
        address creator;
        uint128 amount;
        bool paid;
        address paidBy;
        uint64 paidBlock;
        string title;
        address[] recipients;
        uint16[] shares;
    }
    mapping(uint256 => Order) private orders;

    error InvalidOrder();
    error InvalidAmount();
    error InvalidRecipients();
    error InvalidShares();
    error InvalidTitle();
    error AlreadyPaid();
    error TransferFailed(uint256 recipientIndex);
    error Reentrancy();
    event OrderCreated(uint256 indexed orderId, address indexed creator, uint256 amount);
    event OrderPaid(uint256 indexed orderId, address indexed payer, uint256 amount, address[] recipients, uint256[] payouts);

    function createOrder(uint128 amount, address[] calldata recipients, uint16[] calldata shares, string calldata title) external returns (uint256 id) {
        uint256 count = recipients.length;
        if (count < 2 || count > MAX_RECIPIENTS || count != shares.length) revert InvalidRecipients();
        if (amount == 0 || amount % USDC_SCALE != 0) revert InvalidAmount();
        if (bytes(title).length == 0 || bytes(title).length > 180) revert InvalidTitle();
        uint256 sum;
        for (uint256 i; i < count; ++i) {
            if (recipients[i] == address(0) || recipients[i] == address(this)) revert InvalidRecipients();
            for (uint256 j; j < i; ++j) if (recipients[i] == recipients[j]) revert InvalidRecipients();
            if (shares[i] == 0 || (uint256(amount) / USDC_SCALE) * shares[i] / BPS == 0) revert InvalidShares();
            sum += shares[i];
        }
        if (sum != BPS) revert InvalidShares();
        id = nextOrderId++;
        Order storage order = orders[id];
        order.creator = msg.sender;
        order.amount = amount;
        order.title = title;
        order.recipients = recipients;
        order.shares = shares;
        emit OrderCreated(id, msg.sender, amount);
    }

    function getOrder(uint256 id) external view returns (Order memory) {
        if (orders[id].creator == address(0)) revert InvalidOrder();
        return orders[id];
    }

    function getPayouts(uint256 id) public view returns (uint256[] memory payouts) {
        Order storage order = orders[id];
        if (order.creator == address(0)) revert InvalidOrder();
        uint256 count = order.recipients.length;
        payouts = new uint256[](count);
        uint256 allocated;
        for (uint256 i; i < count; ++i) {
            uint256 payout = i == count - 1
                ? uint256(order.amount) - allocated
                : ((uint256(order.amount) / USDC_SCALE) * order.shares[i] / BPS) * USDC_SCALE;
            payouts[i] = payout;
            allocated += payout;
        }
    }

    function pay(uint256 id) external payable {
        if (entered) revert Reentrancy();
        Order storage order = orders[id];
        if (order.creator == address(0)) revert InvalidOrder();
        if (order.paid) revert AlreadyPaid();
        if (msg.value != order.amount) revert InvalidAmount();
        entered = true;
        order.paid = true;
        order.paidBy = msg.sender;
        order.paidBlock = uint64(block.number);
        uint256[] memory payouts = getPayouts(id);
        for (uint256 i; i < payouts.length; ++i) {
            (bool ok,) = payable(order.recipients[i]).call{value:payouts[i]}("");
            if (!ok) revert TransferFailed(i);
        }
        emit OrderPaid(id, msg.sender, msg.value, order.recipients, payouts);
        entered = false;
    }
}
