# Frigate (BLAKE2b) patch notes

This branch is based on `Start9-Community/frigate-startos` commit
`bbaeb60bc48cb1073afa02c4209b4412428d1419`.

## Pinned application sources

- Frigate: `sparrowwallet/frigate` commit
  `77c10e1600c9b073976bb653767877d782f5f2d6` (release 1.5.3)
- Drongo: `privkeyio/drongo` commit
  `707fbba622200c54035a9f279535518e2aaf6319`
- The additional Frigate integration change is in
  `patches/frigate-knots.patch`.

The Docker build verifies the SHA256 digest of both source archives before
building. The runtime remains based on the digest-pinned community images, so
the generic, NVIDIA and AMD/ROCm variants retain their existing GPU support.

## Consensus behavior

The patched Drongo library supports:

- legacy 80-byte headers;
- Knots 164-byte v2 headers;
- the BLAKE2b mining pipeline and final XOR mask;
- the mainnet activation boundary at height 961640;
- v2 header serialization, block identifiers, proof-of-work validation,
  difficulty transition and header-chain validation.

Frigate requests the raw header using `getblockheader(hash, false)`, verifies
its calculated identifier against `bestblockhash`, and forwards the exact raw
header through Electrum. This is necessary because stock Frigate reconstructs
an 80-byte header from the legacy verbose RPC fields.

## Required services

Use the BLAKE2b-compatible Bitcoin Knots and Fulcrum packages. StartOS Exver
flavors are accepted with wildcard dependency ranges because flavored Knots
versions are intentionally incomparable with the community package's stock
Bitcoin version ranges.

Before publishing your fork, change `packageRepo` in
`startos/manifest/index.ts` to the URL of your repository.

## Boundary smoke test

After initial synchronization, query the Frigate interface and confirm:

- height 961639 is 80 bytes;
- height 961640 is 164 bytes;
- the current header is 164 bytes;
- `server.version` negotiates Electrum protocol 1.6.

The included script performs those checks. Against StartOS's TLS endpoint:

```sh
python3 scripts/header-smoke-test.py HOST PORT --ssl
```
