# Frigate (BLAKE2b)

## Documentation

- [Start9 Bitcoin Guides](https://docs.start9.com/bitcoin-guides/) — what an Electrum server is, pointing a wallet at one, and archival versus pruned Bitcoin nodes.
- [Frigate README](https://github.com/sparrowwallet/frigate/blob/master/README.md) — the upstream project page and the full `config.toml` reference.
- [BIP352](https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki) — the Silent Payments specification Frigate implements.

## What you get on StartOS

An Electrum server for the Bitcoin Knots BLAKE2b chain that scans for Silent Payments on your wallet's behalf, without learning which payments are yours. It supports the chain's 164-byte v2 block headers from height 961640 and Electrum protocol 1.6.

Frigate answers Silent Payments queries and forwards ordinary address lookups to **Fulcrum (BLAKE2b)**. Stock Fulcrum and Electrs are not compatible with this chain.

## Getting set up

1. **Install Bitcoin Knots (BLAKE2b)** and let it finish syncing. Frigate needs a full, unpruned node, and you'll be asked to run Bitcoin's **Auto-Configure** to turn on the settings Frigate depends on.
2. **Install Fulcrum (BLAKE2b)** and start it. It may perform its initial sync in parallel with Frigate.
3. **Run Configure Frigate.** Select Fulcrum and adjust the indexing settings if needed. Frigate starts once you save.
4. **Wait for the first index.** This takes hours, sometimes days, depending on your start height and hardware. Frigate's Electrum address does not accept connections until it is done — watch **Sync Progress** for the block it has reached.
5. **Connect your wallet** to Frigate's Electrum address.

## Choosing a start height

Frigate only finds Silent Payments made at or after the block it starts indexing from. The default here is **840000**, which covers every practical Silent Payments wallet and keeps the first index to a reasonable length.

Change it in **Configure Frigate** if you need to:

- **Faster first sync** — if you know your wallet received nothing before a particular block, start there instead.
- **Full history** — set it to **709632**, the block Taproot activated, to index every Silent Payment there has ever been. This adds a great deal of time to the first index and almost nobody needs it.

Lowering the start height later re-indexes the gap; raising it does not delete anything already indexed.

## Using a GPU

Frigate can scan far faster on a GPU. **Compute Backend** in **Configure Frigate** defaults to **Auto**, which uses a GPU when it finds one and the CPU when it doesn't.

Which GPUs are usable depends on the hardware in your server. NVIDIA and AMD cards each need their own build of this package, which StartOS picks for you at install. Intel integrated graphics use the standard build, but only recent ones (roughly 11th-generation Core and newer) — an older Intel chip is not recognised and Frigate falls back to the CPU.

If you are unsure, start it and read the log: Frigate reports either `Using CPU backend for scanning (no GPU detected)` or the GPU it picked, on every launch. Falling back to CPU costs speed and nothing else.

If scanning stalls on a GPU, lower **Batch Size** in **Configure Frigate**. Older cards can choke on the default.

## Limitations

- Frigate is experimental, and so is wallet support for Silent Payments. Treat it as something to try rather than something to depend on.
- Frigate does not answer ordinary address queries on its own. Without BLAKE2b-compatible Fulcrum selected, a general-purpose wallet cannot use it as its only server.
- Do not connect this build to the conventional SHA256 Bitcoin network or to stock Fulcrum/Electrs.
