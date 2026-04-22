import { Connection, Keypair } from "@solana/web3.js";
import pLimit from "p-limit";
import BN from "bn.js";
import { AppConfig } from "../config";
import { logger } from "../utils/logger";
import { formatAmount, shortKey } from "../utils/format";
import {
  getVaultInfo,
  getWalletStatus,
  logVaultStatus,
} from "../utils/alpha-vault";

export async function status(
  config: AppConfig,
  wallets: Keypair[],
  verbose: boolean
): Promise<void> {
  const connection = new Connection(config.rpcUrl, "confirmed");

  const vaultInfo = await getVaultInfo(connection, config.alphaVault);
  logVaultStatus(vaultInfo);

  logger.info("");
  logger.info("=== Wallet Status ===");

  const limit = pLimit(10);

  let totalDeposited = new BN(0);
  let totalClaimable = new BN(0);
  let totalClaimed = new BN(0);
  let totalFilled = new BN(0);
  let walletsWithDeposits = 0;

  const results = await Promise.all(
    wallets.map((wallet) =>
      limit(async () => {
        const status = await getWalletStatus(
          connection,
          config.alphaVault,
          wallet.publicKey
        );

        const deposited = status?.depositInfo.totalDeposit || new BN(0);
        const filled = status?.depositInfo.totalFilled || new BN(0);
        const claimable = status?.claimInfo.totalClaimable || new BN(0);
        const claimed = status?.claimInfo.totalClaimed || new BN(0);

        return {
          wallet: wallet.publicKey,
          deposited,
          filled,
          claimable,
          claimed,
        };
      })
    )
  );

  for (const r of results) {
    totalDeposited = totalDeposited.add(r.deposited);
    totalFilled = totalFilled.add(r.filled);
    totalClaimable = totalClaimable.add(r.claimable);
    totalClaimed = totalClaimed.add(r.claimed);

    if (!r.deposited.isZero()) {
      walletsWithDeposits++;
    }

    if (verbose) {
      const hasActivity =
        !r.deposited.isZero() ||
        !r.claimable.isZero() ||
        !r.claimed.isZero();

      if (hasActivity) {
        logger.info(`${shortKey(r.wallet.toBase58())}:`);
        logger.info(`  Deposited: ${formatAmount(r.deposited, vaultInfo.quoteDecimals)}`);
        logger.info(`  Filled: ${formatAmount(r.filled, vaultInfo.quoteDecimals)}`);
        logger.info(`  Claimable: ${formatAmount(r.claimable, vaultInfo.baseDecimals)}`);
        logger.info(`  Claimed: ${formatAmount(r.claimed, vaultInfo.baseDecimals)}`);
      }
    }
  }

  logger.info("");
  logger.info("=== Summary ===");
  logger.info(`Total Wallets: ${wallets.length}`);
  logger.info(`Wallets with Deposits: ${walletsWithDeposits}`);
  logger.info(`Total Deposited: ${formatAmount(totalDeposited, vaultInfo.quoteDecimals)}`);
  logger.info(`Total Filled: ${formatAmount(totalFilled, vaultInfo.quoteDecimals)}`);
  logger.info(`Total Claimable: ${formatAmount(totalClaimable, vaultInfo.baseDecimals)}`);
  logger.info(`Total Claimed: ${formatAmount(totalClaimed, vaultInfo.baseDecimals)}`);

  // Show vault participation percentage
  if (!vaultInfo.totalDeposit.isZero()) {
    const participation = totalDeposited
      .mul(new BN(10000))
      .div(vaultInfo.totalDeposit)
      .toNumber() / 100;
    logger.info(`Vault Participation: ${participation.toFixed(2)}%`);
  }
}
