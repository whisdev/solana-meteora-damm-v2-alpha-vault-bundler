import BN from "bn.js";

/** Format a BN raw amount as a decimal string with the given mint decimals. */
export function formatAmount(raw: BN | bigint | number, decimals: number): string {
  const bn = BN.isBN(raw) ? raw : new BN(raw.toString());
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = bn.div(divisor).toString(10);
  const frac = bn.mod(divisor).toString(10).padStart(decimals, "0").replace(/0+$/, "");
  return frac.length === 0 ? whole : `${whole}.${frac}`;
}

/** Parse a decimal string into raw BN units using the given decimals. */
export function parseAmount(value: string, decimals: number): BN {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid amount: ${value}`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Amount ${value} exceeds ${decimals} decimals`);
  }
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return new BN(whole + padded);
}

export function shortKey(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
