#!/usr/bin/env python3
"""Check the SHA256/BLAKE2b header boundary through Frigate's Electrum API."""

import argparse
import json
import socket
import ssl


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("host")
    parser.add_argument("port", type=int)
    parser.add_argument("--ssl", action="store_true", dest="use_ssl")
    args = parser.parse_args()

    connection = socket.create_connection((args.host, args.port), timeout=30)
    if args.use_ssl:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        connection = context.wrap_socket(connection, server_hostname=args.host)

    stream = connection.makefile("rwb")

    def rpc(request_id: int, method: str, params: list):
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params,
        }
        stream.write((json.dumps(request) + "\n").encode())
        stream.flush()
        while True:
            line = stream.readline()
            if not line:
                raise RuntimeError("Frigate closed the connection")
            response = json.loads(line)
            if response.get("id") == request_id:
                if response.get("error") is not None:
                    raise RuntimeError(response["error"])
                return response["result"]

    version = rpc(1, "server.version", ["Frigate BLAKE2b smoke test", ["1.6", "1.6"]])
    assert version[-1] == "1.6", f"expected Electrum 1.6, got {version!r}"
    legacy = rpc(2, "blockchain.block.header", [961639])
    fork = rpc(3, "blockchain.block.header", [961640])
    batch = rpc(4, "blockchain.block.headers", [961639, 2])
    tip = rpc(5, "blockchain.headers.subscribe", [])

    assert len(legacy) // 2 == 80, "height 961639 was not an 80-byte header"
    assert len(fork) // 2 == 164, "height 961640 was not a 164-byte header"
    assert batch["count"] == 2, "batch did not return two headers"
    if "headers" in batch:
        batch_sizes = [len(header) // 2 for header in batch["headers"]]
        assert batch_sizes == [80, 164], "batch was not [80, 164] bytes"
    else:
        assert len(batch["hex"]) // 2 == 244, "batch was not 80 + 164 bytes"
    assert len(tip["hex"]) // 2 == 164, "current tip was not a 164-byte header"

    print("Negotiated version:", version)
    print("Height 961639: 80 bytes")
    print("Height 961640: 164 bytes")
    print("Batch: 80 + 164 bytes")
    print("Current tip:", tip["height"], "(164 bytes)")
    print("ALL FRIGATE BLAKE2B HEADER TESTS PASSED")


if __name__ == "__main__":
    main()
