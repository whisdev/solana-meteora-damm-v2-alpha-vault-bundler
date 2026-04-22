#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config";
import { loadWallets } from "./wallets";
import { logger } from "./utils/logger";
import { deposit } from "./commands/deposit";
import { claim } from "./commands/claim";
import { withdraw } from "./commands/withdraw";
import { status } from "./commands/status";
import { generateWallets } from "./commands/generate-wallets";

const program = new Command();

program
  .name("alpha-bundler")
  .description("Multi-wallet bundler for Meteora Alpha Vault operations")
  .version("0.1.0");

program
  .command("deposit")
  .description("Deposit to Alpha Vault from all wallets")
  .option("--per-wallet <amount>", "Override per-wallet deposit amount")
  .option("--total <amount>", "Override total deposit to split")
  .option("--dry-run", "Simulate without submitting")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      if (opts.perWallet) config.perWalletDeposit = opts.perWallet;
      if (opts.total) config.totalDeposit = opts.total;
      if (opts.dryRun) config.dryRun = true;

      const wallets = loadWallets(config.walletsFile);
      logger.info(`Loaded ${wallets.length} wallets`);

      await deposit(config, wallets);
    } catch (err) {
      logger.error("Deposit failed:", (err as Error).message);
      process.exit(1);
    }
  });

program
  .command("claim")
  .description("Claim purchased tokens from Alpha Vault")
  .option("--dry-run", "Simulate without submitting")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      if (opts.dryRun) config.dryRun = true;

      const wallets = loadWallets(config.walletsFile);
      logger.info(`Loaded ${wallets.length} wallets`);

      await claim(config, wallets);
    } catch (err) {
      logger.error("Claim failed:", (err as Error).message);
      process.exit(1);
    }
  });

program
  .command("withdraw")
  .description("Withdraw unused deposits from Alpha Vault")
  .option("--dry-run", "Simulate without submitting")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      if (opts.dryRun) config.dryRun = true;

      const wallets = loadWallets(config.walletsFile);
      logger.info(`Loaded ${wallets.length} wallets`);

      await withdraw(config, wallets);
    } catch (err) {
      logger.error("Withdraw failed:", (err as Error).message);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Check Alpha Vault and wallet status")
  .option("--verbose", "Show detailed wallet breakdown")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      const wallets = loadWallets(config.walletsFile);
      logger.info(`Loaded ${wallets.length} wallets`);

      await status(config, wallets, opts.verbose);
    } catch (err) {
      logger.error("Status check failed:", (err as Error).message);
      process.exit(1);
    }
  });

program
  .command("generate")
  .description("Generate new wallet keypairs")
  .requiredOption("-n, --count <number>", "Number of wallets to generate")
  .option("-o, --output <file>", "Output file path", "./wallets.json")
  .action(async (opts) => {
    try {
      const count = parseInt(opts.count, 10);
      if (isNaN(count) || count < 1) {
        throw new Error("Count must be a positive integer");
      }
      await generateWallets(count, opts.output);
    } catch (err) {
      logger.error("Generate failed:", (err as Error).message);
      process.exit(1);
    }
  });

program.parse();
