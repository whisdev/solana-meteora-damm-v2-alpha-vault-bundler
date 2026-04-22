import {
  Connection,
  Keypair,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SendTransactionError,
} from "@solana/web3.js";
import { logger } from "./logger";
import { shortKey } from "./format";

export interface SendResult {
  signature: string;
  confirmed: boolean;
  error?: string;
}

export async function buildAndSendTransaction(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  signers: Keypair[]
): Promise<SendResult> {
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    tx.sign(signers);

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    logger.info(`TX sent: ${signature}`);

    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed"
    );

    if (confirmation.value.err) {
      return {
        signature,
        confirmed: false,
        error: JSON.stringify(confirmation.value.err),
      };
    }

    return { signature, confirmed: true };
  } catch (err) {
    if (err instanceof SendTransactionError) {
      return {
        signature: "",
        confirmed: false,
        error: err.message,
      };
    }
    throw err;
  }
}

export async function sendTransactionsSequentially(
  connection: Connection,
  transactions: Array<{
    wallet: Keypair;
    instructions: TransactionInstruction[];
  }>,
  delayMs = 500
): Promise<Map<string, SendResult>> {
  const results = new Map<string, SendResult>();

  for (const { wallet, instructions } of transactions) {
    const walletKey = wallet.publicKey.toBase58();
    logger.info(`Processing wallet: ${shortKey(walletKey)}`);

    const result = await buildAndSendTransaction(
      connection,
      wallet,
      instructions,
      [wallet]
    );

    results.set(walletKey, result);

    if (result.confirmed) {
      logger.success(`${shortKey(walletKey)}: confirmed`);
    } else {
      logger.error(`${shortKey(walletKey)}: failed - ${result.error}`);
    }

    // Small delay between transactions
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}

export async function sendTransactionsParallel(
  connection: Connection,
  transactions: Array<{
    wallet: Keypair;
    instructions: TransactionInstruction[];
  }>,
  concurrency = 5
): Promise<Map<string, SendResult>> {
  const results = new Map<string, SendResult>();
  const chunks: typeof transactions[] = [];

  // Split into chunks for controlled concurrency
  for (let i = 0; i < transactions.length; i += concurrency) {
    chunks.push(transactions.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async ({ wallet, instructions }) => {
        const walletKey = wallet.publicKey.toBase58();
        logger.info(`Processing wallet: ${shortKey(walletKey)}`);

        const result = await buildAndSendTransaction(
          connection,
          wallet,
          instructions,
          [wallet]
        );

        if (result.confirmed) {
          logger.success(`${shortKey(walletKey)}: confirmed`);
        } else {
          logger.error(`${shortKey(walletKey)}: failed - ${result.error}`);
        }

        return { walletKey, result };
      })
    );

    for (const { walletKey, result } of chunkResults) {
      results.set(walletKey, result);
    }
  }

  return results;
}
