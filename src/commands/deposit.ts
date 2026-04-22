import { Connection, Keypair, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { AppConfig } from "../config";
import { logger } from "../utils/logger";
import { parseAmount, formatAmount, shortKey } from "../utils/format";
import {
  createDepositInstructions,
  getVaultInfo,
  logVaultStatus,
} from "../utils/alpha-vault";
import { sendTransactionsParallel } from "../utils/transaction";
import { VaultState } from "@meteora-ag/alpha-vault";

export async function deposit(config: AppConfig, wallets: Keypair[]): Promise<void> {
  const connection = new Connection(config.rpcUrl, "confirmed");

  const vaultInfo = await getVaultInfo(connection, config.alphaVault);
  logVaultStatus(vaultInfo);

  // Check vault state
  if (vaultInfo.state < VaultState.DEPOSITING) {
    throw new Error("Vault deposits not started yet");
  }
  if (vaultInfo.state > VaultState.DEPOSITING) {
    throw new Error("Vault deposits have closed");
  }

  // Calculate deposit amounts
  let perWalletAmount: BN;

  if (config.perWalletDeposit) {
    perWalletAmount = parseAmount(config.perWalletDeposit, vaultInfo.quoteDecimals);
    logger.info(`Deposit per wallet: ${formatAmount(perWalletAmount, vaultInfo.quoteDecimals)}`);
  } else if (config.totalDeposit) {
    const totalAmount = parseAmount(config.totalDeposit, vaultInfo.quoteDecimals);
    perWalletAmount = totalAmount.div(new BN(wallets.length));
    logger.info(`Total deposit: ${formatAmount(totalAmount, vaultInfo.quoteDecimals)}`);
    logger.info(`Per wallet (${wallets.length} wallets): ${formatAmount(perWalletAmount, vaultInfo.quoteDecimals)}`);
  } else {
    throw new Error("Set PER_WALLET_DEPOSIT or TOTAL_DEPOSIT");
  }

  if (config.dryRun) {
    logger.info("[DRY RUN] Would deposit from the following wallets:");
    for (const wallet of wallets) {
      logger.info(`  ${shortKey(wallet.publicKey.toBase58())}: ${formatAmount(perWalletAmount, vaultInfo.quoteDecimals)}`);
    }
    return;
  }

  // Build transactions for each wallet
  logger.info(`Building deposit transactions for ${wallets.length} wallets...`);

  const transactions: Array<{ wallet: Keypair; instructions: TransactionInstruction[] }> = [];

  for (const wallet of wallets) {
    const instructions = await createDepositInstructions(
      connection,
      config.alphaVault,
      wallet,
      perWalletAmount,
      config.computeUnitLimit,
      config.priorityFeeMicroLamports
    );
    transactions.push({ wallet, instructions });
    logger.debug(`Built TX for wallet ${shortKey(wallet.publicKey.toBase58())}`);
  }

  // Submit and confirm transactions
  logger.info(`Submitting ${transactions.length} transactions (concurrency: ${config.concurrency})...`);

  const results = await sendTransactionsParallel(
    connection,
    transactions,
    config.concurrency
  );

  // Summary
  const successful = [...results.values()].filter((r) => r.confirmed).length;
  const failed = results.size - successful;

  logger.info("");
  logger.info("=== Deposit Summary ===");
  logger.success(`Successful: ${successful}/${results.size}`);
  if (failed > 0) {
    logger.error(`Failed: ${failed}/${results.size}`);
  }
}
