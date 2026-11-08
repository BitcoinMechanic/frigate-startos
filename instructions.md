# Frigate (BLAKE2b)

This package appears in StartOS as **Frigate (BLAKE2b)** with service ID `frigate-blake2b`. It is a separate service from the `frigate` package. To keep an existing index (including version `1.5.3:1`), follow the **Migrate from service ID `frigate`** section in the [package README](https://github.com/BitcoinMechanic/frigate-startos#readme): install the new package, stop both services, copy and verify the full application volume over SSH, rebuild the new container, and check its configuration before starting. Normal backups exclude the index. Keep the original service installed and stopped until the new one works, and update wallets to the new Electrum address.

## Documentation

- [Start9 Bitcoin Guides](https://docs.start9.com/bitcoin-guides/) — what an Electrum server is, pointing a wallet at one, and archival versus pruned Bitcoin nodes.
- [Frigate README](https://github.com/sparrowwallet/frigate/blob/master/README.md) — the upstream project page and the full `config.toml` reference.
- [BIP352](https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki) — the Silent Payments specification Frigate implements.

## What you get on StartOS

An Electrum server that scans the blockchain for Silent Payments on your wallet's behalf, without learning which payments are yours. Point a Silent Payments wallet at Frigate's Electrum address and it can find its incoming payments without downloading the chain itself.

Frigate answers Silent Payments queries and nothing else. To use it as your wallet's only server, pair it with **Fulcrum (BLAKE2b)**, which answer ordinary address lookups; Frigate forwards those to the selected backend.

## Server protections

Frigate 1.6 adds limits that protect a public Electrum server from too many connections, oversized requests, and excessive subscriptions. No configuration is needed on StartOS: it automatically accounts for the TLS proxy in front of Frigate, so the proxy does not make all of your clients appear as one limited IP address.

## Getting set up

1. **Install Bitcoin Knots (BLAKE2b)** and let it finish syncing. Frigate needs a full, unpruned node, and you'll be asked to run Bitcoin's **Auto-Configure** to turn on the settings Frigate depends on.
2. **Install Fulcrum (BLAKE2b)** (recommended), and start it. You can skip this, but wallets pointed at Frigate will then only be able to do Silent Payments lookups.
3. **Run Configure Frigate.** Select your Electrum backend, and adjust the indexing settings if you need to. Save, then start Frigate.
4. **Wait for the first index.** This takes hours, sometimes days, depending on your start height and hardware. Frigate's Electrum address does not accept connections until it is done — watch **Sync Progress** for the block it has reached.
5. **Connect your wallet** to Frigate's Electrum address.

## Choosing a start height

Frigate only finds Silent Payments made at or after the block it starts indexing from. New installations default to **709632**, Taproot activation, to cover the full possible Silent Payments history. Existing installations retain their selected height on upgrade.

Stop the service before changing it in **Configure Frigate**:

- **Faster first sync** — if you know your wallet received nothing before a particular block, start there instead.
- **Full history** — set it to **709632**, the block Taproot activated, to index every Silent Payment there has ever been. This is the default for complete history.

**An existing index resumes from its saved checkpoint even if you change the configured height.** To apply a different starting height:

1. Stop Frigate and wait until it shows **Stopped**.
2. Open **Configure Frigate → Advanced settings**.
3. Set **Index Start Height** to **709632** for full history and enable **Rebuild Index**.
4. Save, then start Frigate. Its log should report indexing from the chosen height.

Rebuild Index deletes the current index, including its progress, and builds it again. Configuration is preserved. Wallet connections remain unavailable until the new index catches up. This works even if you already saved the new height with an earlier package version. Leave Rebuild Index off for ordinary configuration changes; changing the height with an existing index and without enabling it is rejected.

## Using a GPU

Frigate can scan far faster on a GPU. **Compute Backend** in **Configure Frigate** defaults to **Auto**, which uses a GPU when it finds one and the CPU when it doesn't.

Which GPUs are usable depends on the hardware in your server. NVIDIA and AMD cards each need their own build of this package, which StartOS picks for you at install. Intel integrated graphics use the standard build, but only recent ones (roughly 11th-generation Core and newer) — an older Intel chip is not recognised and Frigate falls back to the CPU.

If you are unsure, start it and read the log: Frigate reports either `Using CPU backend for scanning (no GPU detected)` or the GPU it picked, on every launch. Falling back to CPU costs speed and nothing else.

If scanning stalls on a GPU, lower **Batch Size** in **Configure Frigate**. Older cards can choke on the default.

## Limitations

- Frigate is experimental, and so is wallet support for Silent Payments. Treat it as something to try rather than something to depend on.
- Frigate does not answer ordinary address queries on its own. Without Fulcrum (BLAKE2b) selected, a general-purpose wallet cannot use it as its only server.
