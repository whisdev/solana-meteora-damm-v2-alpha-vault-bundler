import { Connection, Keypair, TransactionInstruction } from "@solana/web3.js";
import pLimit from "p-limit";
import { AppConfig } from "../config";
import { logger } from "../utils/logger";
import { shortKey } from "../utils/format";
import {
  createClaimInstructions,
  getVaultInfo,
  getWalletStatus,
  logVaultStatus,
} from "../utils/alpha-vault";
import { sendTransactionsParallel } from "../utils/transaction";
import { VaultState } from "@meteora-ag/alpha-vault";

export async function claim(config: AppConfig, wallets: Keypair[]): Promise<void> {
  const connection = new Connection(config.rpcUrl, "confirmed");

  const vaultInfo = await getVaultInfo(connection, config.alphaVault);
  logVaultStatus(vaultInfo);

  if (vaultInfo.state < VaultState.VESTING) {
    throw new Error(`Claiming not available yet. Vault is in state: ${vaultInfo.state}`);
  }

  // Filter wallets with claimable tokens
  logger.info("Checking claimable amounts...");
  const limit = pLimit(10);

  const eligibleWallets: Keypair[] = [];

  await Promise.all(
    wallets.map((wallet) =>
      limit(async () => {
        const status = await getWalletStatus(
          connection,
          config.alphaVault,
          wallet.publicKey
        );
        if (status && status.claimInfo.totalClaimable && !status.claimInfo.totalClaimable.isZero()) {
          logger.info(`${shortKey(wallet.publicKey.toBase58())}: claimable`);
          eligibleWallets.push(wallet);
        } else {
          logger.debug(`${shortKey(wallet.publicKey.toBase58())}: nothing to claim`);
        }
      })
    )
  );

  if (eligibleWallets.length === 0) {
    logger.warn("No wallets have claimable tokens");
    return;
  }

  logger.info(`${eligibleWallets.length} wallets have claimable tokens`);

  if (config.dryRun) {
    logger.info("[DRY RUN] Would claim from the following wallets:");
    for (const wallet of eligibleWallets) {
      logger.info(`  ${shortKey(wallet.publicKey.toBase58())}`);
    }
    return;
  }

  // Build claim transactions
  const transactions: Array<{ wallet: Keypair; instructions: TransactionInstruction[] }> = [];

  for (const wallet of eligibleWallets) {
    const instructions = await createClaimInstructions(
      connection,
      config.alphaVault,
      wallet,
      config.computeUnitLimit,
      config.priorityFeeMicroLamports
    );
    transactions.push({ wallet, instructions });
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
  logger.info("=== Claim Summary ===");
  logger.success(`Successful: ${successful}/${results.size}`);
  if (failed > 0) {
    logger.error(`Failed: ${failed}/${results.size}`);
  }
}
