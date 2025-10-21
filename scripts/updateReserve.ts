import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getNetworkName, getReserveApiUrl, displayConfig } from "../config/env";

async function main() {
  console.log("\n========================================");
  console.log("VETRA RESERVE UPDATE");
  console.log("========================================\n");

  displayConfig();

  const networkName = getNetworkName();
  const [signer] = await ethers.getSigners();

  console.log("Updating reserve with account:", signer.address);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Account balance:", ethers.formatEther(balance), "POL\n");

  // Load deployment info
  const deploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${networkName}.json`
  );

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(
      `Deployment file not found: ${deploymentFile}. Run deployment first.`
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const proxyAddress = deployment.proxy;

  console.log("Vetra contract:", proxyAddress);
  console.log("");

  // Get contract instance
  const vetra = await ethers.getContractAt("Vetra", proxyAddress);

  // Check that caller has admin role
  const DEFAULT_ADMIN_ROLE = await vetra.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await vetra.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!hasAdminRole) {
    throw new Error(
      `Account ${signer.address} does not have DEFAULT_ADMIN_ROLE. Only admin can request reserve updates.`
    );
  }

  // Prepare Chainlink Functions source code
  const apiUrl = getReserveApiUrl();
  console.log("Reserve API URL:", apiUrl);
  console.log("");

  // JavaScript source code for Chainlink Functions
  // This fetches the reserve from FT Asset Management API
  const sourceCode = `
// Chainlink Functions source code for Vetra reserve update
const apiUrl = args[0];

// Make HTTP request to FT Asset Management API
const response = await Functions.makeHttpRequest({
  url: apiUrl,
  method: "GET",
  timeout: 9000
});

if (response.error) {
  throw new Error("API request failed: " + response.error);
}

// Parse FT Asset Management API response
// Expected format: { "StatementSummary": { "TotalBalance": "100000000.00", ... } }
const data = response.data;

if (!data || typeof data !== 'object') {
  throw new Error("Invalid API response: expected object");
}

if (!data.StatementSummary || typeof data.StatementSummary !== 'object') {
  throw new Error("Invalid API response: missing StatementSummary");
}

const totalBalance = data.StatementSummary.TotalBalance;

if (!totalBalance || typeof totalBalance !== 'string') {
  throw new Error("Invalid API response: missing or invalid TotalBalance");
}

// Parse balance string (e.g., "100000000.00") to float
const usdBalance = parseFloat(totalBalance);

if (isNaN(usdBalance) || usdBalance < 0) {
  throw new Error("Invalid balance value: " + totalBalance);
}

// Convert to 8 decimals (contract expects USD with 8 decimals)
// Example: $100,000,000.00 -> 10000000000000000 (10^16)
const usdWith8Decimals = Math.floor(usdBalance * 100000000);

// Generate monotonic nonce (timestamp in milliseconds)
const nonce = Date.now();

// ABI-encode response as (uint256, uint256) tuple
// The contract uses abi.decode(response, (uint256, uint256))
// So we must return properly ABI-encoded data
const abiCoder = ethers.utils.defaultAbiCoder;
const encoded = abiCoder.encode(
  ['uint256', 'uint256'],
  [usdWith8Decimals, nonce]
);

return encoded;
  `.trim();

  console.log("Chainlink Functions Source Code:");
  console.log("-----------------------------------");
  console.log(sourceCode);
  console.log("-----------------------------------\n");

  const args = [apiUrl];

  console.log("Requesting reserve update...");
  console.log("");

  try {
    // Request reserve update
    const tx = await vetra.requestReserveUpdate(sourceCode, args);
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

    // Parse events
    const events = receipt?.logs
      .map((log: any) => {
        try {
          return vetra.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((e: any) => e !== null);

    const reserveUpdateEvent = events?.find(
      (e: any) => e?.name === "ReserveUpdateRequested"
    );

    if (reserveUpdateEvent) {
      const requestId = reserveUpdateEvent.args[0];
      const requester = reserveUpdateEvent.args[1];
      const timestamp = reserveUpdateEvent.args[2];

      console.log("\n✅ Reserve update requested:");
      console.log("- Request ID:", requestId);
      console.log("- Requester:", requester);
      console.log("- Timestamp:", new Date(Number(timestamp) * 1000).toISOString());
      console.log("");
      console.log("⏳ Waiting for Chainlink Functions to fulfill the request...");
      console.log(
        "   This may take 1-2 minutes. Monitor events with: npm run monitor:" +
          networkName
      );
      console.log("");
      console.log("   Request ID to watch:", requestId);
    }

    console.log("\n========================================");
    console.log("RESERVE UPDATE SUMMARY");
    console.log("========================================");
    console.log("Status: Request submitted ✅");
    console.log("Transaction:", tx.hash);
    console.log("Network:", networkName);
    console.log("========================================\n");
  } catch (error: any) {
    console.error("\n❌ Error requesting reserve update:");
    console.error(error.message);

    if (error.data) {
      console.error("Error data:", error.data);
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
