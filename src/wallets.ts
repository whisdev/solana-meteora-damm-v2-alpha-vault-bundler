import * as fs from "fs";
import * as path from "path";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

/**
 * Load wallets from a JSON file. The file may contain either:
 *   - an array of base58 secret keys (strings), or
 *   - an array of byte-array secret keys (number[][])
 *
 * Duplicate keys are removed. Throws if zero valid keys are found.
 */
export function loadWallets(filePath: string): Keypair[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Wallets file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Wallets file is not valid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Wallets file must contain a JSON array");
  }

  const seen = new Set<string>();
  const out: Keypair[] = [];

  for (const [i, entry] of parsed.entries()) {
    let kp: Keypair;
    try {
      if (typeof entry === "string") {
        const bytes = bs58.decode(entry.trim());
        if (bytes.length !== 64) {
          throw new Error(`Expected 64-byte secret key, got ${bytes.length} bytes`);
        }
        kp = Keypair.fromSecretKey(bytes);
      } else if (Array.isArray(entry)) {
        const bytes = Uint8Array.from(entry as number[]);
        if (bytes.length !== 64) {
          throw new Error(`Expected 64-byte secret key, got ${bytes.length} bytes`);
        }
        kp = Keypair.fromSecretKey(bytes);
      } else {
        throw new Error(`Unsupported entry type: ${typeof entry}`);
      }
    } catch (e) {
      throw new Error(`Failed to load wallet at index ${i}: ${(e as Error).message}`);
    }
    const pk = kp.publicKey.toBase58();
    if (seen.has(pk)) continue;
    seen.add(pk);
    out.push(kp);
  }

  if (out.length === 0) {
    throw new Error("No valid wallets loaded");
  }
  return out;
}
