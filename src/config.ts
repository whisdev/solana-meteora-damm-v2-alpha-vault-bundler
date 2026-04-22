import "dotenv/config";
import { PublicKey } from "@solana/web3.js";

export interface AppConfig {
  rpcUrl: string;
  alphaVault: PublicKey;
  walletsFile: string;
  perWalletDeposit?: string;
  totalDeposit?: string;
  priorityFeeMicroLamports: number;
  computeUnitLimit: number;
  concurrency: number;
  dryRun: boolean;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function optional(name: string, fallback = ""): string {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : fallback;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v || v.trim().length === 0) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`Env var ${name} must be an integer, got: ${v}`);
  }
  return n;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (!v) return fallback;
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
}

export function loadConfig(): AppConfig {
  const cfg: AppConfig = {
    rpcUrl: required("RPC_URL"),
    alphaVault: new PublicKey(required("ALPHA_VAULT_ADDRESS")),
    walletsFile: optional("WALLETS_FILE", "./wallets.json"),
    perWalletDeposit: optional("PER_WALLET_DEPOSIT") || undefined,
    totalDeposit: optional("TOTAL_DEPOSIT") || undefined,
    priorityFeeMicroLamports: intEnv("PRIORITY_FEE_MICROLAMPORTS", 50_000),
    computeUnitLimit: intEnv("COMPUTE_UNIT_LIMIT", 400_000),
    concurrency: intEnv("CONCURRENCY", 5),
    dryRun: boolEnv("DRY_RUN", false),
  };

  if (cfg.perWalletDeposit && cfg.totalDeposit) {
    throw new Error("Set only one of PER_WALLET_DEPOSIT or TOTAL_DEPOSIT, not both");
  }

  return cfg;
}
