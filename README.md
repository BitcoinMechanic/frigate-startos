<p align="center">
  <img src="icon.png" alt="Frigate Logo" width="21%">
</p>

# Frigate (BLAKE2b) on StartOS

> Everything not listed in this document should behave the same as upstream
> Frigate. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[Frigate](https://github.com/sparrowwallet/frigate) is an experimental Electrum server from the Sparrow Wallet team. It scans the chain for Silent Payments (BIP352) on a wallet's behalf using ephemeral client keys, keeps the resulting tweak index in DuckDB, and can offload the scan to a GPU. It is not the Frigate NVR project.

- **Upstream repo:** <https://github.com/sparrowwallet/frigate>
- **Wrapper repo:** <https://github.com/BitcoinMechanic/frigate-startos>
- **Parent wrapper repo:** <https://github.com/Start9-Community/frigate-startos>
- **StartOS service ID:** `frigate-blake2b`
- **StartOS display name:** Frigate (BLAKE2b)

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)
- [Migrate from the old service ID](#migrate-from-service-id-frigate-including-1531)

---

## Image and Container Runtime

This package builds Frigate 1.6.1 from a SHA256-verified source archive, applies `patches/frigate-knots.patch`, and uses the pinned BLAKE2b-aware `privkeyio/drongo` library. The Dockerfile runs both projects' tests and creates a Java runtime image, then overlays it on the digest-pinned community image to retain its entrypoint and GPU libraries. Source commits and archive digests are recorded in `Dockerfile`.

The patch reads raw headers from Bitcoin RPC and validates their identifiers, preserving both legacy 80-byte and BLAKE2b 164-byte headers. This is a BLAKE2b application build, not just a renamed stock package. Build locally with `make generic-x86` (or `make nvidia-x86` / `make amd-x86`); the result is `frigate-blake2b_<variant>_x86_64.s9pk`.

| Property      | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Image         | `ghcr.io/remcoros/frigate-docker`                                    |
| Architectures | x86_64 and aarch64 for `generic`; x86_64 only for `nvidia` and `amd` |
| Entrypoint    | The image's own, unmodified — it execs `frigate -n "$NETWORK"`       |

| Subcontainer | Purpose                                       |
| ------------ | --------------------------------------------- |
| `main`       | The `primary` daemon — the one to `attach` to |

The package declares `hardwareAcceleration`, which is what gets `/dev/dri`, `/dev/nvidia*`, and `/dev/kfd` into the container. It ships as three build variants under one package id, and StartOS installs the most hardware-specific one a given server qualifies for:

| Variant   | Image   | Hardware requirement | GPU path                                           |
| --------- | ------- | -------------------- | -------------------------------------------------- |
| `generic` | default | none                 | CPU, or a **recent** Intel iGPU via bundled OpenCL |
| `nvidia`  | default | an `nvidia` GPU      | CUDA, via the NVIDIA container runtime             |
| `amd`     | `-rocm` | an `amdgpu` GPU      | ROCm OpenCL                                        |

`generic` carries no hardware requirement deliberately: it is the variant every server can install, and Frigate falls back to CPU when it finds no usable OpenCL device.

**The Intel path is narrower than "has an Intel iGPU".** The image bundles a current `intel-compute-runtime`, which supports Gen12 (Tiger Lake / Arc / Xe) and newer only — Intel moved Gen8–Gen11 to a separate legacy runtime that this image does not carry. On an older iGPU the runtime refuses the device outright (`FATAL: Unknown device: deviceId: <id>`), `clinfo` reports zero platforms, and Frigate logs `Using CPU backend for scanning (no GPU detected)` and proceeds on CPU. Verified on a Comet Lake UHD (Gen9.5, PCI `8086:9bca`), which does **not** work. Nothing breaks; it is simply slower than the hardware suggests.

## Volume and Data Layout

One volume, holding the config, the index, and the package's own record of which Electrum backend the user picked.

| Volume | Mount Point      | Purpose                                     |
| ------ | ---------------- | ------------------------------------------- |
| `main` | `/root/.frigate` | Frigate's home directory — config and index |

| Path                | What                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `config.toml`       | Frigate's configuration (see File Models)                          |
| `db/frigate.duckdb` | The Silent Payments tweak index; rebuildable, excluded from backup |
| `store.json`        | StartOS-side state: the selected Electrum backend                  |

Bitcoin's data directory is also mounted, read-only, at `/root/.bitcoin`. Frigate reads only `.cookie` from it, for RPC authentication.

## File Models

One model, `config.toml`, and the package owns roughly half of it. The other half is yours to set through an action.

`config.toml` is seeded with the package's defaults on install, then partially rewritten on every start. The keys the package re-asserts each time are the ones that describe where Bitcoin is, and a hand edit to any of them will not survive a restart:

| Key                            | Value the package writes                                            |
| ------------------------------ | ------------------------------------------------------------------- |
| `core.connect`                 | always `true`                                                       |
| `core.server`                  | Bitcoin's RPC address, resolved live over the container bridge      |
| `core.authType`                | always `COOKIE`                                                     |
| `core.dataDir`                 | `/root/.bitcoin`, where Bitcoin's volume is mounted                 |
| `core.zmqSequenceEndpoint`     | Bitcoin's ZMQ sequence address, resolved live                       |
| `server.backendElectrumServer` | the selected backend's address, or empty when none is selected      |
| `limits.excludedSubnets`       | upstream loopback defaults plus StartOS's current TLS-proxy address |

`index.startHeight`, `index.cacheSize`, `scan.computeBackend`, and `scan.batchSize` are seeded once and thereafter belong to the **Configure Frigate** action. Those four are watched rather than rewritten, so hand edits survive. Configure is available only while stopped; start the service after saving. A running service restarts when a watched value changes outside the action, but changing `startHeight` alone never backfills an existing index: Frigate resumes from its persisted database checkpoint. Use the explicit rebuild option to apply a new start height to an existing index.

Any key the package does not name is left alone entirely, including the upstream keys this package exposes no control for. The `limits.excludedSubnets` exception is necessary because StartOS terminates TLS and opens the upstream connection from its `lxcbr0` bridge address, which the package reads with `sdk.getOsIp()` whenever Frigate starts. Without it, Frigate 1.6 would treat every StartOS client as one IP for its new per-IP limits and request pacing.

`store.json` records which Electrum backend the user selected. It is deliberately separate from `config.toml`: the backend's actual address is assigned by StartOS and can change, so the selection has to outlive any particular address.

## Dependencies

BLAKE2b-compatible Bitcoin is required; BLAKE2b-compatible Fulcrum is optional but strongly recommended. Stock Bitcoin and Electrs are not suitable backends for this chain. Dependencies retain IDs `bitcoind` and `fulcrum`. Wildcard version ranges accept the flavored BLAKE2b packages, as in the original BLAKE2b branch; those ranges do not verify which chain the installed services follow. Fulcrum is gated only on its `primary` health check so both services can synchronize together.

| Dependency | Required | Gated on health checks      | Why                                                                                                                                                                                                                       |
| ---------- | -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bitcoind` | Yes      | `bitcoind`, `sync-progress` | Supplies blocks over RPC and new-block events over ZMQ. Its data directory is mounted read-only at `/root/.bitcoin` for cookie authentication. Frigate needs an archival node with `txindex` and ZMQ enabled — see Tasks. |
| `fulcrum`  | No       | `primary`                   | Answers ordinary address lookups, which Frigate does not implement. Required only while it is the selected backend.                                                                                                       |

Fulcrum becomes a dependency only while selected. The backend's address is resolved from the running service on each start rather than hard-coded, so a reinstall or a reassigned port heals on the next restart.

Selecting `None` is allowed and leaves Frigate answering Silent Payments queries alone, with nothing behind it to proxy to — a wallet connected to it will fail every ordinary address lookup. That is the shape of the complaint when a user reports the server "works but can't find my transactions".

## Network Access and Interfaces

One interface, serving the Electrum protocol.

| Interface | Id         | Type | Container port | Description                             |
| --------- | ---------- | ---- | -------------- | --------------------------------------- |
| Electrum  | `electrum` | api  | 50001          | The Electrum protocol endpoint over SSL |

The binding is exported with SSL added, so StartOS terminates TLS on its own certificate and forwards to Frigate's plaintext listener. Addresses render with an `ssl://` or `tcp://` scheme so they can be pasted straight into a wallet. The plaintext port is reachable over the container bridge — that is the address a co-located service resolves — and from nowhere else.

## Installation and First-Run Flow

Frigate cannot start until Bitcoin is configured for it and the user has confirmed the indexing settings, so the install ends in two prompts rather than a running service.

1. A `config.toml` is written with this package's defaults.
2. A critical **Configure Frigate** task is raised. Nothing starts until it is answered.
3. A critical **Auto-Configure** task is raised on Bitcoin, to turn on `txindex` and ZMQ and turn off pruning.
4. Once both are satisfied and Bitcoin is synced, start Frigate. A fresh installation indexes from the configured start height (default **709632**, Taproot activation).

The initial index is long — hours to days depending on the start height, the compute backend, and the hardware. The Electrum port stays closed until it finishes.

## Actions

One action, and the service is unusable until it has been run once.

**Configure Frigate** picks the Electrum backend and the indexing settings. Run it at install (a task requires it), and again to change backends, to re-index from a different height, or to move the scan between CPU and GPU.

- **Availability:** only while stopped. Stop Frigate and wait for shutdown before opening Configure.
- **What it changes:** the backend selection and the `index` and `scan` settings. **Rebuild Index** defaults to off on every form opening and is never stored as a recurring command.
- **Existing index:** changing **Index Start Height** requires **Rebuild Index** if `main/db` exists. Without it the action fails before writing settings, so it cannot silently save a height that the existing database ignores.
- **Explicit rebuild:** deletes only `main/db`, including its DuckDB WAL, after settings have been saved. The next start builds a fresh index from the selected height; it does not just fill the missing gap. Configuration and the backend choice remain intact. Rebuilding can take hours or days, during which wallets cannot use Frigate.
- **Earlier broken saves:** if version `1.6.1:2` already saved a lower height, stop the service, leave that height selected, enable **Rebuild Index**, save, then start. The explicit option works even when the saved height is unchanged.
- **Repeat safety:** normal saves preserve the database; every explicitly requested rebuild deletes it again. Custom `[database].url` configurations cannot be rebuilt by this action and must be managed separately.
- **What happens next:** start Frigate and watch its startup log for the `Indexing ... (start to end)` range and **Sync Progress** for the current height. Upgrading this package never deletes an existing index or overwrites an existing start height.

## Tasks

Two, both `critical`, both raised at install. A critical task blocks the service from starting and replaces the ordinary controls until it is cleared.

**Configure Frigate** (on Frigate) — raised once, on install. Cleared by running the **Configure Frigate** action. It does not come back.

**Auto-Configure** (on **Bitcoin**, not on Frigate) — raised whenever Bitcoin's configuration does not have `txindex` on, pruning off, and ZMQ on. Cleared by running Bitcoin's **Auto-Configure** action, which sets all three. It returns if any of them is later turned off. The user sees this prompt on Bitcoin's page, where nothing identifies Frigate as the service that asked for it.

## Health Checks

Two checks, both keyed on whether the Electrum port has opened, which happens only once the index is complete.

| Check           | Displayed         | Probe                                                  |
| --------------- | ----------------- | ------------------------------------------------------ |
| `primary`       | "Electrum Server" | Port 50001 is listening                                |
| `sync-progress` | "Sync Progress"   | Port 50001, falling back to the last indexing log line |

A **failing** `primary` — as opposed to a loading one — means Frigate started but never got as far as announcing an index. Check the service logs for a connection refused against Bitcoin's RPC or ZMQ port, and check that Bitcoin's **Auto-Configure** task is clear; ZMQ turned off is the usual cause. Readiness deliberately keys off that announcement, which Frigate emits within a few seconds of launch, rather than off its progress lines, which it emits only every 30 seconds: keying off progress would leave a perfectly healthy service reporting failure for the first half-minute of every start. Once indexing has begun, both checks report _loading_, and `sync-progress` shows the block it has reached; that state is normal and can persist for days on a first index. Both go green together when the port opens.

Two behaviors around those checks look like faults and are not. **Frigate restarts several times whenever Bitcoin restarts**: it exits rather than reconnecting when Bitcoin's RPC goes away — first on the missing `.cookie`, then on `Loading block index…` while Bitcoin comes back — so StartOS restarts it a handful of times over ten to fifteen seconds, backing off between attempts, until Bitcoin is answering. The index survives; Frigate resumes from the last block it wrote. A loop that does _not_ settle means Bitcoin itself is looping, so read Bitcoin's logs rather than Frigate's. And **`sync-progress` that has not moved in hours** on a GPU backend is usually a batch too large for the card: lower **Batch Size** through Configure Frigate, and set **Compute Backend** to `CPU` to confirm the GPU is the cause if it still hangs.

## Backups and Restore

The volume is copied wholesale — `sdk.Backups.ofVolumes('main')` — minus the index.

`db/` is excluded. The DuckDB tweak index is derived data: it is large, it changes constantly, and it can be rebuilt from the chain. What the backup does keep is `config.toml` and `store.json`, so a restored instance comes back with the same settings and the same backend selection.

A restored instance therefore has to re-index from the configured start height before it will serve. Bitcoin must be present and synced first, exactly as on a fresh install.

## Limitations and Differences

Most of these come from the package taking ownership of the Bitcoin connection and the TLS listener, so that neither has to be configured by hand.

1. **No SSL configuration.** Upstream's `server.sslCert` / `server.sslKey` are not exposed; StartOS terminates TLS on its own certificate instead.
2. **The Bitcoin connection is not yours to set.** `core.server`, `core.dataDir`, `core.authType` and `core.zmqSequenceEndpoint` are rewritten on every start to point at the Bitcoin service on this server. Cookie authentication is the only mode; `USERPASS` is not exposed.
3. **BLAKE2b backend only.** This build offers BLAKE2b-compatible Fulcrum or no backend; stock Electrs is not supported.
4. **Full-history default.** New installations begin at Taproot activation, **709632**, matching upstream. Existing installations keep their configured height; lowering it requires an explicit index rebuild.
5. **The AMD variant is built on ROCm nightlies.** The image pins a nightly ROCm release; it has not been tested by the packager on real AMD hardware.
6. **Upstream is experimental.** Silent Payments support is still moving, and so is the wallet support for it.
7. **StartOS manages the Frigate 1.6 proxy exception.** The platform terminates TLS before it reaches Frigate, so the package reads the current bridge address with `sdk.getOsIp()` and includes it in `limits.excludedSubnets`. Do not remove it: otherwise every client through StartOS is treated as the same IP and can hit Frigate's per-IP limits.

---

## Quick Reference for AI Consumers

```yaml
package_id: frigate-blake2b
image: locally built BLAKE2b application over ghcr.io/remcoros/frigate-docker
architectures:
  - x86_64
  - aarch64 # generic variant only; nvidia and amd are x86_64
subcontainers:
  - main # the only container
volumes:
  main: /root/.frigate
file_models:
  - config.toml
  - store.json
startos_managed_env_vars:
  - NETWORK
dependencies:
  - bitcoind # required; its volume is mounted read-only at /root/.bitcoin
  - fulcrum # optional, recommended
interfaces:
  electrum: { type: api, port: 50001 }
actions:
  - config
tasks:
  - { action: config, severity: critical }
  - { action: bitcoind/autoconfig, severity: critical }
health_checks:
  - primary # displayed "Electrum Server"
  - sync-progress # displayed "Sync Progress"
```

## Migrate from service ID `frigate` (including 1.5.3:1)

Changing the ID creates a new StartOS service. Sideloading this package does not update `frigate`, transfer its volume, or preserve its network addresses. The ordinary StartOS backup of the old package excludes `db/`; restoring that backup alone will not preserve the index.

The following procedure targets **StartOS 0.4.1.2**, on the **same box**, with SSH administrator access. It copies the application volume, not StartOS's package records. The 1.5.3 and 1.6.1 application sources use the same index table definitions; nevertheless, retain the old installation until the new one has opened your actual database and caught up successfully. A database indexed on another chain is not a BLAKE2b index: if the old service followed the stock Bitcoin chain past the fork, rebuild the index instead of importing it.

1. Record the old service's index height, indexing settings, backend choice, and wallet connection addresses. Take a normal StartOS backup for recovery of settings. Keep the old package installed.
2. Sideload the locally built `frigate-blake2b_generic_x86_64.s9pk` (or the matching GPU/architecture variant). Leave its **Configure Frigate** task unanswered so it does not begin indexing. If you already configured it, stop it.
3. Stop **both** `frigate` and `frigate-blake2b` in StartOS. Wait until both show **Stopped**, not **Stopping**. Keep them stopped throughout the copy and checksum verification. Do not run backup, restore, upgrade, or configuration actions during this operation.
4. SSH into the **StartOS box**, not the build VM. Start a root shell with `sudo -i`, then run the following. It refuses a target that already contains a database, saves the new package's initial volume, and uses a copy rather than a move. Allow enough free space for a second full index.

   ```bash
   bash <<'MIGRATE'
   set -euo pipefail
   source_volume=/media/startos/data/package-data/volumes/frigate/data/main
   target_volume=/media/startos/data/package-data/volumes/frigate-blake2b/data/main
   saved_volume="${target_volume}.before-import-$(date +%Y%m%d-%H%M%S)"
   test -f "$source_volume/config.toml"
   test -f "$source_volume/db/frigate.duckdb"
   test -d "$target_volume"
   test ! -e "$target_volume/db"
   test ! -e "$saved_volume"
   du -sh "$source_volume"
   df -h "$target_volume"
   cp -a --reflink=auto "$target_volume" "$saved_volume"
   rsync -aHAX --numeric-ids --delete --info=progress2 "$source_volume/" "$target_volume/"
   differences=$(rsync -aHAXnci --numeric-ids --delete "$source_volume/" "$target_volume/")
   if [ -n "$differences" ]; then
     printf '%s\n' "$differences"
     echo 'Verification failed. Keep both services stopped.' >&2
     exit 1
   fi
   echo "Copy verified. Initial destination saved at $saved_volume"
   MIGRATE
   ```

   Copy the **whole** `main` volume, including `db/`, any DuckDB WAL, `config.toml`, and `store.json` when present. Do not copy only the `.duckdb` file, rename the package directory, edit StartOS's database, or copy the old package's assets. The guarded `--delete` above removes generated destination files absent from the old volume, notably a default `store.json` that would otherwise hide the old backend choice. It never deletes source files.
5. Rebuild the **new service's container** to rerun initialization against the copied settings. From an authenticated CLI on the build VM, use `start-cli -H <box-url> package rebuild frigate-blake2b`. Wait for initialization to finish, then open **Configure Frigate**, check the backend and indexing settings against your notes, leave **Rebuild Index** off to retain the copied index, and save. Initialization infers a missing `store.json` from the old backend URL; runtime setup regenerates Bitcoin RPC/ZMQ and backend addresses and the StartOS TLS-proxy exemption. Do not copy OS data-version metadata: this is a new service, so old-ID version migrations are not automatically executed.
6. Start the new service. Check its logs for database errors and verify it resumes from the saved index height, catches up, and passes both health checks. Only after that, point wallets at its **new** Electrum address and confirm a known wallet's history. For BLAKE2b header validation, run `python3 scripts/header-smoke-test.py HOST PORT --ssl` from this repository against the new TLS address. Leave the old service stopped.

**Rollback:** stop the new service, wait for **Stopped**, start the original `frigate`, and restore wallets' original addresses. Its volume was never moved or upgraded. Do not copy the new database back over the old one. Uninstall the old service only after you are satisfied with the new one; uninstalling deletes its rollback data. If the new service reports database incompatibility, preserve both copies for diagnosis and rebuild only the new index as a fallback.

These steps do not claim an end-to-end migration test on your box: the actual copied database and wallet behavior must be checked in steps 5–6.
