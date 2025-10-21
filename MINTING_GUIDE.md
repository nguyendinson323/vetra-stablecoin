# Vetra Stablecoin - Minting Guide

## How to Test Minting with Live Reserves

This guide walks you through the complete process of minting VTR tokens with live reserves from the FT Asset Management API.

---

## Prerequisites

Before you can mint tokens, ensure:

1. ✅ Contract is deployed
2. ✅ Contract is added as a consumer to your Chainlink Functions subscription
3. ✅ Reserves have been updated successfully (via Chainlink Functions)
4. ✅ Your wallet has the `MINTER_ROLE`
5. ✅ Contract is not paused

---

## Step-by-Step Process

### Step 1: Add Contract as Consumer to Chainlink Subscription

**Why**: The contract needs permission to use your Chainlink Functions subscription to pay for reserve updates.

**For Testnet (Amoy)**:
1. Go to https://functions.chain.link
2. Connect your wallet (must be subscription owner)
3. Navigate to subscription #498
4. Click "Add Consumer"
5. Enter contract address: `0x1B99b8455e3d2c801cb9eaE7A48e849f52Da0E49`
6. Confirm transaction

**For Mainnet (Polygon)**:
1. Go to https://functions.chain.link
2. Connect your wallet (must be subscription owner)
3. Navigate to subscription #162
4. Click "Add Consumer"
5. Enter contract address: `0xFE5537979E85887fD2D46d3F903959E630c22E87`
6. Confirm transaction

---

### Step 2: Update Reserves

Run the reserve update script to fetch the latest USD balance from FT Asset Management:

**Testnet**:
```bash
npm run update-reserve:amoy
```

**Mainnet**:
```bash
npm run update-reserve:polygon
```

**What happens**:
1. Script sends Chainlink Functions request with JavaScript code
2. Chainlink DON executes the code (calls FT Asset Management API)
3. Response is parsed: `StatementSummary.TotalBalance`
4. DON reaches consensus on the result
5. Callback is sent to your contract (1-2 minutes)
6. Contract updates `lastReserveUsd`, `lastReserveTimestamp`, `lastReserveNonce`

**Expected output**:
```
✅ Reserve update requested:
- Request ID: 0xa7f507c3980ae015552e256d36cb5e45a7b58af8e53b31e4984ba6d3140ee0b4
- Requester: 0xE10f5d79A1b636F92BD51A2c204093D5bD3Ea551
- Timestamp: 2025-10-21T12:32:55.000Z

⏳ Waiting for Chainlink Functions to fulfill the request...
   This may take 1-2 minutes.
```

---

### Step 3: Monitor for Reserve Update Fulfillment

Wait 1-2 minutes for Chainlink Functions to fulfill the request, then check events:

**Testnet**:
```bash
npm run monitor:amoy
```

**Mainnet**:
```bash
npm run monitor:polygon
```

**Look for `ReserveUpdated` event**:
```
Event: ReserveUpdated
  USD Amount: 10000000000000000 (8 decimals) → $100,000,000.00
  Nonce: 1729510375000
  Timestamp: 2025-10-21T12:34:35.000Z
  Request ID: 0xa7f507c3980ae015552e256d36cb5e45a7b58af8e53b31e4984ba6d3140ee0b4
```

**If no ReserveUpdated event appears after 5 minutes**:
- Check Chainlink Functions subscription has LINK balance
- Verify contract was added as consumer
- Check FT Asset Management API is accessible
- Look for `RequestFailed` events

---

### Step 4: Test Mint Tokens

Once reserves are updated, run the test mint script:

**Testnet**:
```bash
npm run test-mint:amoy
```

**Mainnet**:
```bash
npm run test-mint:polygon
```

**The script will**:
1. ✅ Verify you have `MINTER_ROLE`
2. ✅ Check reserve status (fresh vs stale)
3. ✅ Calculate available minting capacity
4. ✅ Mint test amount (100 VTR or available capacity)
5. ✅ Display minted tokens and events
6. ✅ Show post-mint state

**Expected output**:
```
========================================
CURRENT CONTRACT STATE
========================================
Total Supply: 0.0 VTR
Last Reserve USD (8 decimals): 10000000000000000
Last Reserve Timestamp: 2025-10-21T12:34:35.000Z
Last Reserve Nonce: 1729510375000
Reserve TTL: 900 seconds
Contract Paused: false

Reserve Age: 45 seconds
Reserve Status: ✅ Fresh

========================================
MINTING CAPACITY
========================================
Reserve (8 decimals): 10000000000000000 → 100000000.0 VTR max supply
Current Supply: 0.0 VTR
Available Capacity: 100000000.0 VTR

========================================
MINT TEST
========================================
Test mint amount: 100.0 VTR
Recipient: 0x8BD094FB9e3D50C2DD9FA1266381D30a8e2442A8

⏳ Preparing to mint...

Transaction hash: 0x...
✅ Transaction confirmed in block: 27996250

✅ Tokens minted successfully!
========================================
MINT EVENT DETAILS
========================================
Recipient: 0x8BD094FB9e3D50C2DD9FA1266381D30a8e2442A8
Amount: 100.0 VTR
Operator: 0x8BD094FB9e3D50C2DD9FA1266381D30a8e2442A8
Total Supply After: 100.0 VTR
Reserve After: 10000000000000000
Timestamp: 2025-10-21T12:35:20.000Z

========================================
POST-MINT STATE
========================================
New Total Supply: 100.0 VTR
Recipient Balance: 100.0 VTR
Remaining Capacity: 99999900.0 VTR
```

---

## Reserve Scaling Math

Understanding how reserves convert to minting capacity:

### Example: $100,000,000.00 USD Reserve

```
FT Asset Management API:
  TotalBalance: "100000000.00" (string with 2 decimals)
         ↓
  Parse to float: 100000000.00
         ↓
  Convert to 8 decimals: 100000000.00 × 10^8 = 10000000000000000
         ↓
  Store in contract: lastReserveUsd = 10000000000000000
         ↓
  Scale to 18 decimals (for minting): 10000000000000000 × 10^10 = 100000000000000000000000000
         ↓
  Maximum mintable: 100,000,000 VTR (perfect 1:1 backing)
```

### Formula

```solidity
// In Vetra.sol
uint256 reserveScaled = lastReserveUsd * RESERVE_TO_TOKEN_SCALE;  // × 10^10
uint256 availableCapacity = reserveScaled - totalSupply();
```

**Example**:
- Reserve: $100M → `10000000000000000` (8 decimals)
- Scaled: `100000000000000000000000000` (18 decimals) = 100M VTR
- Current supply: `100000000000000000000` (100 VTR)
- Available: `99999900000000000000000000` (99,999,900 VTR)

---

## Common Errors and Solutions

### Error: "ReserveStale"

**Cause**: Reserve data is older than 15 minutes (TTL = 900s)

**Solution**:
```bash
npm run update-reserve:amoy  # or :polygon
# Wait 1-2 minutes for fulfillment
npm run test-mint:amoy       # Try again
```

---

### Error: "ReserveInsufficient"

**Cause**: Trying to mint more than the 1:1 backing allows

**Example**:
- Reserve: $1,000 → Max 1,000 VTR
- Current supply: 950 VTR
- Trying to mint: 100 VTR
- Error: 950 + 100 = 1,050 > 1,000

**Solution**:
- Mint smaller amount (≤ 50 VTR in example above)
- Wait for FT Asset Management to increase USD reserves
- Update reserves after increase

---

### Error: "Account does not have MINTER_ROLE"

**Cause**: Your wallet doesn't have permission to mint

**Check current roles**:
```bash
npm run monitor:amoy
# Look for RoleGranted events
```

**Solution** (requires admin):
```javascript
// Admin must grant MINTER_ROLE to your address
const MINTER_ROLE = await vetra.MINTER_ROLE();
await vetra.grantRole(MINTER_ROLE, "0xYourAddress");
```

---

### Error: "Pausable: paused"

**Cause**: Contract is paused (emergency mode)

**Solution** (requires admin):
```javascript
await vetra.unpause();
```

---

### Error: "MintLimitExceeded"

**Cause**: Mint amount exceeds per-transaction limit (if enabled)

**Check limit**:
```javascript
const limit = await vetra.mintPerTxLimit();
console.log("Per-tx limit:", ethers.formatEther(limit), "VTR");
```

**Solution**:
- Mint smaller amount
- Or admin can increase/disable limit: `await vetra.setMintPerTxLimit(newLimit)`

---

### Error: "RecipientNotAllowed"

**Cause**: Recipient not on allowlist (if enabled)

**Check allowlist status**:
```javascript
const enabled = await vetra.allowlistEnabled();
const allowed = await vetra.allowlist("0xRecipientAddress");
```

**Solution** (requires admin):
```javascript
await vetra.setAllowlistAddress("0xRecipientAddress", true);
```

---

## Testing Checklist

Before testing minting on mainnet:

### Testnet Testing (Amoy)
- [ ] Contract deployed successfully
- [ ] Contract added to Chainlink subscription #498
- [ ] Subscription has test LINK balance
- [ ] Reserve update successful (ReserveUpdated event emitted)
- [ ] Test mint 100 VTR successful
- [ ] Check recipient balance matches
- [ ] Test minting with stale reserve (should fail)
- [ ] Test minting beyond capacity (should fail)
- [ ] Test minting when paused (should fail)
- [ ] Monitor events with `npm run monitor:amoy`

### Mainnet Preparation
- [ ] All testnet tests passed
- [ ] Contract deployed to mainnet
- [ ] Contract added to Chainlink subscription #162
- [ ] Subscription funded with LINK (~72 LINK/month for 5-min updates)
- [ ] Governance wallets secured (hardware wallets recommended)
- [ ] FT Asset Management API consistently accessible
- [ ] Emergency pause procedure documented
- [ ] Monitoring and alerting set up

---

## Monitoring Best Practices

### Real-Time Monitoring

Run the monitor script to watch events:

```bash
npm run monitor:amoy     # Testnet
npm run monitor:polygon  # Mainnet
```

### Key Events to Watch

1. **ReserveUpdated** - Confirms reserves are updating
   - Should occur every 5 minutes (automated)
   - Check `usdAmount` matches FT Asset Management API
   - Check `nonce` is monotonically increasing

2. **TokensMinted** - Track all minting activity
   - Verify amounts are within reserves
   - Monitor operator addresses

3. **TokensBurned** - Track token burns
   - Verify burn operations complete successfully

4. **Paused/Unpaused** - Emergency state changes

5. **RequestFailed** - Chainlink Functions errors
   - Investigate failures immediately
   - Check subscription LINK balance
   - Verify API accessibility

---

## Automated Reserve Updates

For production, set up automated reserve updates every 5 minutes:

### Option 1: Cron Job (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add line (runs every 5 minutes)
*/5 * * * * cd /path/to/Vetra-stablecoin && npm run update-reserve:polygon >> /var/log/vetra-reserves.log 2>&1
```

### Option 2: Node.js Script

```javascript
const { exec } = require('child_process');

setInterval(() => {
  console.log('[' + new Date().toISOString() + '] Updating reserves...');
  exec('npm run update-reserve:polygon', (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error);
      // Send alert
    } else {
      console.log(stdout);
    }
  });
}, 5 * 60 * 1000); // 5 minutes
```

### Option 3: Backend Service

Integrate reserve updates into your backend:
- Schedule job every 5 minutes
- Monitor for failures
- Alert on consecutive failures
- Log all requests and responses

---

## Cost Estimation

### Chainlink Functions Costs

**Per reserve update**: ~0.2 LINK

**Monthly costs** (5-minute updates):
- Updates per day: 288 (24 hours × 60 min ÷ 5 min)
- Updates per month: ~8,640 (288 × 30 days)
- LINK required: ~1,728 LINK/month (8,640 × 0.2)

**Recommended**: Fund subscription with 2,000 LINK initially, monitor usage, and refill as needed.

### Gas Costs

- **Mint**: ~100,000 gas (~0.001 POL at 50 gwei)
- **Burn**: ~80,000 gas
- **Update reserve (request)**: ~150,000 gas
- **Pause/Unpause**: ~50,000 gas

---

## Quick Reference Commands

```bash
# Configuration validation
npm run validate

# Deploy
npm run deploy:amoy
npm run deploy:polygon

# Update reserves
npm run update-reserve:amoy
npm run update-reserve:polygon

# Test minting
npm run test-mint:amoy
npm run test-mint:polygon

# Monitor events
npm run monitor:amoy
npm run monitor:polygon

# Verify on Polygonscan
npm run verify:amoy
npm run verify:polygon

# Run tests
npm test
```

---

## Support & Troubleshooting

If you encounter issues:

1. **Check configuration**: `npm run validate`
2. **Monitor events**: `npm run monitor:amoy`
3. **Verify reserve status**: Check `lastReserveTimestamp` and `lastReserveUsd`
4. **Check subscription**: Ensure LINK balance is sufficient
5. **Review logs**: Look for error messages in console output
6. **Test on Amoy first**: Always test changes on testnet before mainnet

For Chainlink Functions issues:
- Docs: https://docs.chain.link/chainlink-functions
- Dashboard: https://functions.chain.link
- Support: https://discord.gg/chainlink

---

## Security Reminders

- ✅ Never commit `.env` to version control
- ✅ Use hardware wallets for mainnet admin/minter accounts
- ✅ Test all operations on Amoy testnet first
- ✅ Monitor reserve updates continuously
- ✅ Have emergency pause procedure ready
- ✅ Keep Chainlink subscription funded
- ✅ Regularly audit minting activity
- ✅ Verify FT Asset Management API responses match on-chain reserves

---

## Next Steps

1. Add contract as consumer to Chainlink subscription
2. Update reserves and verify fulfillment
3. Test mint on testnet
4. Set up automated reserve updates
5. Deploy to mainnet (if not done)
6. Test mint on mainnet (small amount)
7. Set up monitoring and alerting
8. Document operational procedures

**Happy minting! 🚀**
