import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import bs58 from "bs58";
import { logger } from "../utils/logger";

export async function generateWallets(
  count: number,
  outputFile: string
): Promise<void> {
  logger.info(`Generating ${count} wallets...`);

  const wallets: string[] = [];

  for (let i = 0; i < count; i++) {
    const keypair = Keypair.generate();
    const secretKey = bs58.encode(keypair.secretKey);
    wallets.push(secretKey);
    logger.info(`Wallet ${i + 1}: ${keypair.publicKey.toBase58()}`);
  }

  fs.writeFileSync(outputFile, JSON.stringify(wallets, null, 2));
  logger.success(`Saved ${count} wallets to ${outputFile}`);
  logger.warn("IMPORTANT: Back up this file securely. Loss means loss of funds.");
}
