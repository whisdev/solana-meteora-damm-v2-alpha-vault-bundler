# Solana Meteora Alpha Vault Token Bundler

**Create large marketcap in short time using Alpha Vault. Move and register tokens with exchange-grade metrics.**

A high-performance multi-wallet tool for Meteora Alpha Vault operations on Solana. Execute deposits, claims, and withdrawals across unlimited wallets with parallel transaction processing.

## Why Alpha Vault Bundler?

- **Liquidity** - Inject substantial liquidity into Alpha Vault pools across multiple wallets simultaneously
- **Holders** - Distribute tokens across unlimited holder wallets efficiently
- **Volume** - Generate organic trading volume through coordinated vault interactions
- **Marketcap** - Build significant marketcap rapidly through strategic vault deposits and claims
- **Unlimited Bundler** - No wallet limits. Process 10, 100, or 1000+ wallets with parallel execution
- **Stealth Mode** - Transactions appear as separate organic interactions, avoiding malicious detection patterns

## Features

- **Parallel Execution** - Submit multiple transactions concurrently with configurable concurrency
- **Auto Confirmation** - Every transaction is confirmed before proceeding
- **Multi-Operation Support** - Deposit, claim tokens, and withdraw in coordinated batches
- **Flexible Sizing** - Set per-wallet amounts or auto-distribute totals evenly
- **Priority Fees** - Configurable compute unit pricing for faster inclusion
- **Dry Run Mode** - Simulate operations before submitting
- **Real-time Status** - Check vault state, deposits, and claimable amounts

## Installation

```bash
npm install
npm run build
```

## Quick Start

1. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your RPC and vault address
   ```

2. **Add wallets**
   ```bash
   cp wallets.example.json wallets.json
   # Add your base58 private keys to the array
   ```

3. **Run operations**
   ```bash
   # Check vault status
   npm run status

   # Deposit from all wallets
   npm run deposit

   # Claim tokens after vault closes
   npm run claim

   # Withdraw unused deposits
   npm run withdraw
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_URL` | Solana RPC endpoint | Required |
| `ALPHA_VAULT_ADDRESS` | Target Alpha Vault pubkey | Required |
| `WALLETS_FILE` | Path to wallets JSON | `./wallets.json` |
| `PER_WALLET_DEPOSIT` | Fixed deposit per wallet | - |
| `TOTAL_DEPOSIT` | Total to split across wallets | - |
| `PRIORITY_FEE_MICROLAMPORTS` | Compute unit price | `50000` |
| `COMPUTE_UNIT_LIMIT` | Compute units per tx | `400000` |
| `CONCURRENCY` | Parallel transactions | `5` |
| `DRY_RUN` | Simulate without submitting | `false` |

### Wallets File Format

```json
[
  "base58_private_key_1",
  "base58_private_key_2",
  "base58_private_key_3"
]
```

Or byte array format:
```json
[
  [1, 2, 3, ... 64 bytes],
  [1, 2, 3, ... 64 bytes]
]
```

## Commands

```bash
# Generate new wallets (specify count)
npm run generate -- -n 100 -o wallets.json

# Deposit to vault (Pro-rata or FCFS mode)
npm run deposit

# Claim purchased tokens after vault closes
npm run claim

# Withdraw unused deposit tokens
npm run withdraw

# Check vault and wallet status
npm run status

# Development mode with hot reload
npm run dev
```

## CLI Usage

```bash
# Build first
npm run build

# Run via CLI
./dist/index.js deposit --per-wallet 100
./dist/index.js claim --dry-run
./dist/index.js status --verbose
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Alpha Vault Bundler                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Wallet 1  ──┐                                          │
│  Wallet 2  ──┼──▶  Parallel TX Submit  ──▶  Alpha Vault │
│  Wallet N  ──┘          │                               │
│                         ▼                               │
│              Confirm Each Transaction                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Alpha Vault Modes

### Pro-rata Mode
- Deposits accepted throughout the entire deposit period
- Final allocation proportional to deposit share
- Excess deposits automatically refundable

### FCFS (First-Come-First-Serve) Mode
- Fixed cap per wallet
- First depositors get full allocation
- Submit early for guaranteed slots

## Advanced Usage

### Adjusting Concurrency

Control how many transactions are sent in parallel:

```bash
# Lower concurrency for stability
CONCURRENCY=3 npm run deposit

# Higher concurrency for speed (requires good RPC)
CONCURRENCY=10 npm run deposit
```

### Using Premium RPC

For best results, use a premium RPC endpoint:

```bash
RPC_URL=https://your-premium-rpc.com npm run deposit
```

## Security

- Private keys never leave your machine
- No external API calls except RPC
- Open source and auditable

## Troubleshooting

**Transactions failing?**
- Increase `PRIORITY_FEE_MICROLAMPORTS` (try 100000+)
- Reduce `CONCURRENCY` to avoid rate limiting
- Use a premium RPC endpoint

**Timeout errors?**
- Reduce `CONCURRENCY`
- Check RPC endpoint health
- Try during lower network congestion

**Wallet balance issues?**
- Ensure each wallet has SOL for fees
- Check quote token (e.g., USDC) balance

## Support
https://t.me/snipmaxi

## License

MIT

## Disclaimer

This software is provided for educational and research purposes. Users are responsible for compliance with applicable laws and platform terms of service. Use at your own risk.
