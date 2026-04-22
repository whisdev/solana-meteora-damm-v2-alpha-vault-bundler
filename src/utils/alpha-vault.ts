import {
  Connection,
  PublicKey,
  Keypair,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import AlphaVault, { ClaimInfo, DepositInfo, VaultMode, VaultState } from "@meteora-ag/alpha-vault";
import BN from "bn.js";
import { logger } from "./logger";
import { formatAmount, shortKey } from "./format";

export interface VaultInfo {
  vaultPubkey: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseDecimals: number;
  quoteDecimals: number;
  totalDeposit: BN;
  maxCap: BN;
  mode: VaultMode;
  state: VaultState;
  firstJoinPoint: number;
  lastJoinPoint: number;
  startVestingPoint: number;
  endVestingPoint: number;
}

export interface WalletVaultStatus {
  wallet: PublicKey;
  depositInfo: DepositInfo;
  claimInfo: ClaimInfo;
}

export async function getAlphaVaultInstance(
  connection: Connection,
  vaultPubkey: PublicKey
): Promise<AlphaVault> {
  return AlphaVault.create(connection, vaultPubkey);
}

export async function getVaultInfo(
  connection: Connection,
  vaultPubkey: PublicKey
): Promise<VaultInfo> {
  const alphaVault = await AlphaVault.create(connection, vaultPubkey);
  const vault = alphaVault.vault;
  const vaultPoint = alphaVault.vaultPoint;

  return {
    vaultPubkey,
    baseMint: vault.baseMint,
    quoteMint: vault.quoteMint,
    baseDecimals: alphaVault.baseMintInfo.mint.decimals,
    quoteDecimals: alphaVault.quoteMintInfo.mint.decimals,
    totalDeposit: vault.totalDeposit,
    maxCap: vault.maxBuyingCap,
    mode: alphaVault.mode,
    state: alphaVault.vaultState,
    firstJoinPoint: vaultPoint.firstJoinPoint,
    lastJoinPoint: vaultPoint.lastJoinPoint,
    startVestingPoint: vaultPoint.startVestingPoint,
    endVestingPoint: vaultPoint.endVestingPoint,
  };
}

export async function getWalletStatus(
  connection: Connection,
  vaultPubkey: PublicKey,
  wallet: PublicKey
): Promise<WalletVaultStatus | null> {
  try {
    const alphaVault = await AlphaVault.create(connection, vaultPubkey);
    const escrow = await alphaVault.getEscrow(wallet);

    if (!escrow) {
      return null;
    }

    const depositInfo = alphaVault.getDepositInfo(escrow);
    const claimInfo = alphaVault.getClaimInfo(escrow);

    return {
      wallet,
      depositInfo,
      claimInfo,
    };
  } catch {
    return null;
  }
}

export async function createDepositInstructions(
  connection: Connection,
  vaultPubkey: PublicKey,
  wallet: Keypair,
  amount: BN,
  computeUnitLimit: number,
  priorityFeeMicroLamports: number
): Promise<TransactionInstruction[]> {
  const alphaVault = await AlphaVault.create(connection, vaultPubkey);
  const vault = alphaVault.vault;

  const instructions: TransactionInstruction[] = [];

  // Compute budget
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit })
  );
  instructions.push(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeMicroLamports })
  );

  // Quote token ATA
  const quoteAta = getAssociatedTokenAddressSync(
    vault.quoteMint,
    wallet.publicKey
  );
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey,
      quoteAta,
      wallet.publicKey,
      vault.quoteMint
    )
  );

  // Deposit instruction
  const depositTx = await alphaVault.deposit(amount, wallet.publicKey);
  instructions.push(...depositTx.instructions);

  return instructions;
}

export async function createClaimInstructions(
  connection: Connection,
  vaultPubkey: PublicKey,
  wallet: Keypair,
  computeUnitLimit: number,
  priorityFeeMicroLamports: number
): Promise<TransactionInstruction[]> {
  const alphaVault = await AlphaVault.create(connection, vaultPubkey);
  const vault = alphaVault.vault;

  const instructions: TransactionInstruction[] = [];

  // Compute budget
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit })
  );
  instructions.push(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeMicroLamports })
  );

  // Base token ATA for receiving claimed tokens
  const baseAta = getAssociatedTokenAddressSync(
    vault.baseMint,
    wallet.publicKey
  );
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey,
      baseAta,
      wallet.publicKey,
      vault.baseMint
    )
  );

  // Claim instruction
  const claimTx = await alphaVault.claimToken(wallet.publicKey);
  instructions.push(...claimTx.instructions);

  return instructions;
}

export async function createWithdrawInstructions(
  connection: Connection,
  vaultPubkey: PublicKey,
  wallet: Keypair,
  amount: BN,
  computeUnitLimit: number,
  priorityFeeMicroLamports: number
): Promise<TransactionInstruction[]> {
  const alphaVault = await AlphaVault.create(connection, vaultPubkey);

  const instructions: TransactionInstruction[] = [];

  // Compute budget
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit })
  );
  instructions.push(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeMicroLamports })
  );

  // Withdraw instruction
  const withdrawTx = await alphaVault.withdraw(amount, wallet.publicKey);
  instructions.push(...withdrawTx.instructions);

  return instructions;
}

function vaultModeToString(mode: VaultMode): string {
  switch (mode) {
    case VaultMode.PRORATA:
      return "PRORATA";
    case VaultMode.FCFS:
      return "FCFS";
    default:
      return "UNKNOWN";
  }
}

function vaultStateToString(state: VaultState): string {
  switch (state) {
    case VaultState.PREPARING:
      return "PREPARING";
    case VaultState.DEPOSITING:
      return "DEPOSITING";
    case VaultState.PURCHASING:
      return "PURCHASING";
    case VaultState.LOCKING:
      return "LOCKING";
    case VaultState.VESTING:
      return "VESTING";
    case VaultState.ENDED:
      return "ENDED";
    default:
      return "UNKNOWN";
  }
}

export function logVaultStatus(info: VaultInfo): void {
  logger.info("=== Alpha Vault Status ===");
  logger.info(`Vault: ${info.vaultPubkey.toBase58()}`);
  logger.info(`Mode: ${vaultModeToString(info.mode)}`);
  logger.info(`State: ${vaultStateToString(info.state)}`);
  logger.info(`Total Deposited: ${formatAmount(info.totalDeposit, info.quoteDecimals)}`);
  logger.info(`Max Cap: ${formatAmount(info.maxCap, info.quoteDecimals)}`);
  logger.info(`Base Mint: ${shortKey(info.baseMint.toBase58())}`);
  logger.info(`Quote Mint: ${shortKey(info.quoteMint.toBase58())}`);
}
