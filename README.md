# Vetra Stablecoin

**1:1 USD-backed stablecoin with Chainlink Functions proof-of-reserves**

Vetra (VTR) is an upgradeable ERC-20 stablecoin backed 1:1 by USD reserves held by FT Asset Management. The contract uses Chainlink Functions to fetch and verify reserve balances on-chain, ensuring transparency and auditability.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Usage](#usage)
- [Testing](#testing)
- [Contract Details](#contract-details)
- [Security](#security)
- [License](#license)

## Features

### Core Functionality
- **ERC-20 Standard**: Fully compliant ERC-20 token with 18 decimals
- **1:1 USD Backing**: Every VTR token is backed by $1 USD in reserves
- **UUPS Upgradeable**: Secure upgradeability pattern via UUPSUpgradeable
- **Role-Based Access Control**: Separate roles for admins, minters, and burners
- **Pausable**: Emergency pause mechanism for critical situations

### Reserve Management
- **Chainlink Functions Integration**: Automated reserve updates via decentralized oracle network
- **Reserve Freshness**: 15-minute TTL ensures recent reserve data
- **Monotonic Nonce**: Prevents replay attacks and ensures reserve update ordering
- **Supply Invariant**: Enforces `totalSupply() <= reserves` at all times

### Safety Features
- **Optional Per-Transaction Mint Limit**: Configurable maximum mint amount
- **Optional Allowlist**: Restrict minting to approved addresses
- **Event Emission**: Comprehensive events for all critical operations
- **Input Validation**: Zero-address and zero-amount checks

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Vetra Contract                        │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  ERC20         │  │  UUPS          │  │  AccessControl │ │
│  │  Upgradeable   │  │  Upgradeable   │  │  Upgradeable   │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
│                                                                │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  Pausable      │  │  Reserve       │  │  Chainlink     │ │
│  │  Upgradeable   │  │  Management    │  │  Functions     │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ Reserve Updates
                              │
                   ┌──────────┴──────────┐
                   │  Chainlink Functions │
                   │      Network         │
                   └──────────┬──────────┘
                              │
                              │ HTTP Request
                              │
                   ┌──────────▼──────────┐
                   │  FT Asset Management │
                   │    Reserve API       │
                   └─────────────────────┘
```

## Tech Stack

- **Solidity**: ^0.8.24
- **Hardhat**: Smart contract development environment
- **OpenZeppelin**: Upgradeable contracts v5.4.0
- **Chainlink**: Functions v1.5.0
- **TypeScript**: Type-safe scripts and tests
- **Ethers.js**: v6.x for blockchain interactions

## Prerequisites

- Node.js >= 20.x
- npm or yarn
- Git

### Testnet Requirements (Polygon Amoy)
- **3 AMOY POL** per address (for gas)
  - Faucet: https://faucet.polygon.technology/
- **2 test LINK** per address (for Chainlink Functions)
  - Faucet: https://faucets.chain.link/polygon-amoy

### Mainnet Requirements (Polygon PoS)
- POL for gas
- LINK for Chainlink Functions
- Funded Chainlink Functions subscription

## Installation

```bash
# Clone repository
git clone https://github.com/your-org/vetra-stablecoin.git
cd vetra-stablecoin

# Install dependencies
npm install --legacy-peer-deps

# Copy and configure environment
cp .env.example .env
# Edit .env with your configuration
```

## Configuration

### Environment Variables

The project uses a **single `.env` file** with network switching via `NODE_ENV`. All configuration is centralized in `config/env.ts`.

**Key Principle**: Change only `NODE_ENV` to switch networks. No hardcoded addresses!

#### .env Structure

```bash
# Switch between networks
NODE_ENV=development    # or production

# Developer wallet (for testnet)
PRIVATE_KEY_DEV=0x...

# Polygonscan API key
POLYGONSCAN_API_KEY=YOUR_KEY_HERE

# POLYGON AMOY TESTNET (development)
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
AMOY_CHAIN_ID=80002
AMOY_LINK_TOKEN=0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904
AMOY_FUNCTIONS_ROUTER=0xC22a79eBA640940ABB6dF0f7982cc119578E11De
AMOY_DON_ID=0x66756e2d706f6c79676f6e2d616d6f792d310000000000000000000000000000
AMOY_SUBSCRIPTION_ID=YOUR_SUBSCRIPTION_ID
AMOY_ADMIN_ADDRESS=YOUR_DEV_ADDRESS
AMOY_MINTER_ADDRESS=YOUR_DEV_ADDRESS
AMOY_BURNER_ADDRESS=YOUR_DEV_ADDRESS

# POLYGON MAINNET (production)
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_CHAIN_ID=137
POLYGON_LINK_TOKEN=0xb0897686c545045aFc77CF20eC7A532E3120E0F1
POLYGON_FUNCTIONS_ROUTER=0xdc2AAF042Aeff2E68B3e8E33F19e4B9fA7C73F10
POLYGON_DON_ID=0x66756e2d706f6c79676f6e2d6d61696e6e65742d310000000000000000000000
POLYGON_SUBSCRIPTION_ID=YOUR_SUBSCRIPTION_ID
POLYGON_ADMIN_ADDRESS=0x29F1bE1E72c031539bc22437aFde22fF765EE00e
POLYGON_MINTER_ADDRESS=0x308442BBd27CAF66c614471Fb1933f7dd447b5da
POLYGON_BURNER_ADDRESS=0x308442BBd27CAF66c614471Fb1933f7dd447b5da

# Reserve Configuration
RESERVE_API_URL=https://my.ftassetmanagement.com/api/bcl.asp?KeyCodeGUID=...
RESERVE_UPDATE_INTERVAL_SECONDS=300
RESERVE_TTL_SECONDS=900
MINT_PER_TX_LIMIT=0
ALLOWLIST_ENABLED=false
```

### Reserve Scaling Math

The contract uses **8-decimal precision for USD** and **18-decimal precision for tokens**:

- **Reserve API**: Returns USD balance (e.g., `100.00` USD)
- **Contract Storage**: `lastReserveUsd` = USD × 10^8 (e.g., `10000000000` for $100)
- **Token Amount**: VTR = USD × 10^18 (e.g., `100000000000000000000` for 100 VTR)

**Conversion Formula**:
```
tokenAmount = reserveUsd × (10^18 / 10^8)
tokenAmount = reserveUsd × 10^10
```

**Example**:
- Reserve = $1,000,000 USD
- Stored as: `100000000000000` (8 decimals)
- Max mintable: `1000000000000000000000000` (1M tokens with 18 decimals)

## Deployment

### Step 1: Fund Wallets

#### Testnet (Amoy)
```bash
# Get Amoy POL from faucet
# https://faucet.polygon.technology/

# Get test LINK from faucet
# https://faucets.chain.link/polygon-amoy
```

#### Mainnet (Polygon)
- Ensure admin/minter/burner addresses are funded
- Ensure deployer has sufficient POL for gas

### Step 2: Create Chainlink Functions Subscription

1. Visit Chainlink Functions UI
   - Testnet: https://functions.chain.link/polygon-amoy
   - Mainnet: https://functions.chain.link/polygon

2. Create subscription and fund with LINK

3. Note subscription ID and update `.env`

### Step 3: Deploy Contract

#### Deploy to Testnet (Amoy)
```bash
# Set environment
export NODE_ENV=development  # or edit .env

# Deploy
npm run deploy:amoy

# Output will show:
# - Proxy address
# - Implementation address
# - Role assignments
# - Saved to deployments/amoy.json
```

#### Deploy to Mainnet (Polygon)
```bash
# Set environment
export NODE_ENV=production  # or edit .env

# Deploy
npm run deploy:polygon

# Output saved to deployments/polygon.json
```

### Step 4: Add Contract as Consumer

After deployment, add the deployed contract address as a consumer to your Chainlink Functions subscription:

1. Go to Functions UI
2. Select your subscription
3. Click "Add consumer"
4. Enter proxy address from deployment output

### Step 5: Update Reserve

```bash
# Testnet
npm run update-reserve:amoy

# Mainnet
npm run update-reserve:polygon
```

This submits a Chainlink Functions request. Wait 1-2 minutes for fulfillment.

### Step 6: Verify on Polygonscan

```bash
# Testnet
npm run verify:amoy

# Mainnet
npm run verify:polygon
```

## Usage

### Minting Tokens

Only addresses with `MINTER_ROLE` can mint:

```solidity
// Requires:
// 1. Fresh reserve (within TTL)
// 2. Sufficient reserve backing
// 3. Contract not paused
vetra.mint(recipientAddress, amount);
```

### Burning Tokens

**Operator Burn** (BURNER_ROLE):
```solidity
vetra.burnFrom(accountAddress, amount);
```

**Self-Burn** (anyone):
```solidity
vetra.burn(amount);
```

### Monitoring

Real-time event monitoring:
```bash
npm run monitor:amoy
# or
npm run monitor:polygon
```

Shows:
- TokensMinted / TokensBurned events
- Reserve updates
- Configuration changes
- Current contract state

### Administrative Functions

Only `DEFAULT_ADMIN_ROLE`:

```solidity
// Pause/unpause
vetra.pause();
vetra.unpause();

// Update reserve TTL
vetra.setReserveTTL(newTTLSeconds);

// Set mint limit
vetra.setMintPerTxLimit(limitAmount);

// Enable/disable allowlist
vetra.setAllowlistEnabled(true);
vetra.setAllowlistAddress(address, allowed);

// Update Chainlink config
vetra.updateChainlinkConfig(router, donId, subId, gasLimit);

// Upgrade contract
vetra.upgradeToAndCall(newImplementation, data);
```

## Testing

### Run All Tests
```bash
npm test
```

### Test Suites

1. **vetra.roles.spec.ts** (35 tests)
   - Role assignment and verification
   - Admin-only functions
   - Pausable behavior

2. **vetra.core.spec.ts** (22 tests)
   - ERC-20 functionality
   - Minting/burning access control
   - Input validation

3. **vetra.reserve.spec.ts** (22 tests)
   - Reserve management
   - TTL enforcement
   - Scaling and conversions

4. **vetra.upgrade.spec.ts** (12 tests)
   - UUPS upgradeability
   - State preservation
   - Authorization

### Coverage
```bash
npm run test:coverage
```

## Contract Details

### Vetra.sol

**Address:** See `deployments/<network>.json`

#### Roles
- `DEFAULT_ADMIN_ROLE`: Governance (upgrades, config, pause)
- `MINTER_ROLE`: Can mint tokens (respecting reserve limits)
- `BURNER_ROLE`: Can burn from any account

#### State Variables
```solidity
uint256 public lastReserveUsd;        // USD reserve (8 decimals)
uint256 public lastReserveTimestamp;  // Last update timestamp
uint256 public lastReserveNonce;      // Monotonic nonce
uint256 public reserveTTL;            // Freshness requirement (900s)
uint256 public mintPerTxLimit;        // Optional per-tx limit
bool public allowlistEnabled;         // Optional allowlist toggle
```

#### Events
```solidity
event TokensMinted(address indexed to, uint256 amount, address indexed operator,
                   uint256 totalSupplyAfter, uint256 reserveAfter, uint256 timestamp);
event TokensBurned(address indexed from, uint256 amount, address indexed operator,
                   uint256 totalSupplyAfter, uint256 timestamp);
event ReserveUpdateRequested(bytes32 indexed requestId, address indexed requester,
                              uint256 timestamp);
event ReserveUpdated(uint256 usdAmount, uint256 nonce, uint256 timestamp,
                     bytes32 indexed requestId);
```

## Security

### Audit Status
⚠️ **This contract has not been audited.** Use at your own risk.

### Security Features
- UUPS upgrade pattern (only admin)
- Role-based access control
- Reserve freshness checks
- Nonce monotonicity
- Pausable emergency stop
- Input validation
- No hardcoded addresses

### Operational Security

**DO:**
- ✅ Use hardware wallets for mainnet admin keys
- ✅ Test thoroughly on Amoy before mainnet
- ✅ Monitor reserve updates regularly
- ✅ Keep Chainlink subscription funded
- ✅ Verify all contracts on Polygonscan

**DON'T:**
- ❌ Share private keys
- ❌ Commit .env to version control
- ❌ Skip testing reserve updates
- ❌ Upgrade without testing on testnet first

### Emergency Procedures

**If reserve becomes stale:**
```bash
npm run update-reserve:<network>
```

**If malicious activity detected:**
```solidity
vetra.pause();  // Only admin
```

**If upgrade needed:**
1. Test upgrade on Amoy
2. Prepare VetraV2 contract
3. Call `upgradeToAndCall()` (only admin)
4. Verify state preservation

## Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile contracts |
| `npm test` | Run all tests |
| `npm run test:coverage` | Generate coverage report |
| `npm run deploy:amoy` | Deploy to Amoy testnet |
| `npm run deploy:polygon` | Deploy to Polygon mainnet |
| `npm run verify:amoy` | Verify on Amoy Polygonscan |
| `npm run verify:polygon` | Verify on Polygonscan |
| `npm run update-reserve:amoy` | Update reserve on Amoy |
| `npm run update-reserve:polygon` | Update reserve on Polygon |
| `npm run monitor:amoy` | Monitor Amoy events |
| `npm run monitor:polygon` | Monitor Polygon events |
| `npm run clean` | Clean artifacts |

## Troubleshooting

### "Reserve is stale" error
- **Cause**: Reserve data older than TTL (15 min)
- **Fix**: Run `npm run update-reserve:<network>`

### "Insufficient reserve" error
- **Cause**: Trying to mint more than reserve allows
- **Fix**: Wait for reserve update or reduce mint amount

### Chainlink Functions request fails
- **Cause**: Insufficient LINK in subscription
- **Fix**: Fund subscription with LINK

### Transaction reverts with "AccessControl" error
- **Cause**: Wrong role for operation
- **Fix**: Ensure signer has correct role (admin/minter/burner)

## Deployment Addresses

### Polygon Amoy Testnet
- Proxy: `<See deployments/amoy.json after deployment>`
- Implementation: `<See deployments/amoy.json>`

### Polygon Mainnet
- Proxy: `<See deployments/polygon.json after deployment>`
- Implementation: `<See deployments/polygon.json>`

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/vetra-stablecoin/issues
- Documentation: This README
- Chainlink Docs: https://docs.chain.link/chainlink-functions

---

**Built with Chainlink Functions on Polygon**
