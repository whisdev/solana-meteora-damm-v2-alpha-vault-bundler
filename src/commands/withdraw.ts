import { Connection, Keypair, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import pLimit from "p-limit";
import { AppConfig } from "../config";
import { logger } from "../utils/logger";
import { formatAmount, shortKey } from "../utils/format";
import {
  createWithdrawInstructions,
  getVaultInfo,
  getWalletStatus,
  logVaultStatus,
} from "../utils/alpha-vault";
import { sendTransactionsParallel } from "../utils/transaction";

interface WithdrawableWallet {
  wallet: Keypair;
  amount: BN;
}

export async function withdraw(config: AppConfig, wallets: Keypair[]): Promise<void> {
  const connection = new Connection(config.rpcUrl, "confirmed");

  const vaultInfo = await getVaultInfo(connection, config.alphaVault);
  logVaultStatus(vaultInfo);

  // Check withdrawable amounts
  logger.info("Checking withdrawable amounts...");
  const limit = pLimit(10);

  const withdrawableWallets: WithdrawableWallet[] = [];

  await Promise.all(
    wallets.map((wallet) =>
      limit(async () => {
        const status = await getWalletStatus(
          connection,
          config.alphaVault,
          wallet.publicKey
        );

        if (status) {
          // Calculate withdrawable: totalDeposit - totalFilled - totalReturned
          const depositInfo = status.depositInfo;
          const withdrawable = depositInfo.totalDeposit
            .sub(depositInfo.totalFilled)
            .sub(depositInfo.totalReturned);

          if (withdrawable.gtn(0)) {
            logger.info(
              `${shortKey(wallet.publicKey.toBase58())}: ${formatAmount(
                withdrawable,
                vaultInfo.quoteDecimals
              )} withdrawable`
            );
            withdrawableWallets.push({
              wallet,
              amount: withdrawable,
            });
          } else {
            logger.debug(`${shortKey(wallet.publicKey.toBase58())}: nothing to withdraw`);
          }
        }
      })
    )
  );

  if (withdrawableWallets.length === 0) {
    logger.warn("No wallets have withdrawable deposits");
    return;
  }

  const totalWithdrawable = withdrawableWallets.reduce(
    (acc, w) => acc.add(w.amount),
    new BN(0)
  );
  logger.info(
    `${withdrawableWallets.length} wallets, total: ${formatAmount(
      totalWithdrawable,
      vaultInfo.quoteDecimals
    )}`
  );

  if (config.dryRun) {
    logger.info("[DRY RUN] Would withdraw from the following wallets:");
    for (const { wallet, amount } of withdrawableWallets) {
      logger.info(`  ${shortKey(wallet.publicKey.toBase58())}: ${formatAmount(amount, vaultInfo.quoteDecimals)}`);
    }
    return;
  }

  // Build withdraw transactions
  const transactions: Array<{ wallet: Keypair; instructions: TransactionInstruction[] }> = [];

  for (const { wallet, amount } of withdrawableWallets) {
    const instructions = await createWithdrawInstructions(
      connection,
      config.alphaVault,
      wallet,
      amount,
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
  logger.info("=== Withdraw Summary ===");
  logger.success(`Successful: ${successful}/${results.size}`);
  if (failed > 0) {
    logger.error(`Failed: ${failed}/${results.size}`);
  }
}
