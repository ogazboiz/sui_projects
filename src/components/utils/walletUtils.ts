import { formatAddress } from "@mysten/sui.js/utils";

// Format a Sui address for display (0x1234...6789)
export function shortenAddress(address: string): string {
  return formatAddress(address);
}

// Check if the wallet is installed by name
export function isWalletInstalled(walletName: string): boolean {
  if (typeof window === "undefined") return false;
  
  // Check if wallet is in the window.wallet object
  // @ts-expect-error - window.wallet might not exist
  return !!window.wallet?.[walletName];
}

// Get a list of available wallet adapters
export function getAvailableWallets(): string[] {
  if (typeof window === "undefined") return [];
  
  const wallets = [];
  
  // @ts-expect-error - window.suiWallet might not exist
  if (window.suiWallet) wallets.push("Sui Wallet");
  // @ts-expect-error - window.martian might not exist
  if (window.martian) wallets.push("Martian Wallet");
  // @ts-expect-error - window.ethos might not exist
  if (window.ethos) wallets.push("Ethos Wallet");
  // @ts-expect-error - window.suiet might not exist
  if (window.suiet) wallets.push("Suiet Wallet");
  
  return wallets;
}

// Get the current network name (testnet, devnet, mainnet)
export function getCurrentNetwork(networkUrl: string): string {
  if (networkUrl.includes("testnet")) return "testnet";
  if (networkUrl.includes("devnet")) return "devnet";
  if (networkUrl.includes("mainnet")) return "mainnet";
  return "unknown";
}

// Convert Sui amount from MIST to SUI (1 SUI = 10^9 MIST)
export function convertMistToSui(mistAmount: bigint | number): number {
  const amount = typeof mistAmount === "bigint" ? Number(mistAmount) : mistAmount;
  return amount / 1_000_000_000;
}

// Convert SUI amount to MIST
export function convertSuiToMist(suiAmount: number): bigint {
  return BigInt(Math.floor(suiAmount * 1_000_000_000));
}