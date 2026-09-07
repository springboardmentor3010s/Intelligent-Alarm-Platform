"""Dev-only TCP relay: forwards emulator/localhost connections to the backend.

Workaround: on some hosts, HTTP requests WITH a request body sent from the
Android emulator to uvicorn directly (10.0.2.2 / LAN IP / adb reverse) are
accepted but never answered, while GETs work. A plain socket relay on the host
(0.0.0.0) carries the same bytes to 127.0.0.1:8000 reliably.

Run:  python scripts/host_relay.py [listen_port] [target_host] [target_port]
Default: listen 0.0.0.0:8090 -> 127.0.0.1:8000

Pair with mobile/.env: EXPO_PUBLIC_API_URL=http://10.0.2.2:8090
"""

import socket
import sys
import threading

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
TARGET_HOST = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
TARGET_PORT = int(sys.argv[3]) if len(sys.argv) > 3 else 8000


def pump(src: socket.socket, dst: socket.socket) -> None:
    try:
        while True:
            data = src.recv(65536)
            if not data:
                try:
                    dst.shutdown(socket.SHUT_WR)
                except OSError:
                    pass
                break
            dst.sendall(data)
    except OSError:
        pass


def handle(client: socket.socket, addr: object) -> None:
    target = None
    try:
        target = socket.create_connection((TARGET_HOST, TARGET_PORT), timeout=15)
        threads = [
            threading.Thread(target=pump, args=(client, target), daemon=True),
            threading.Thread(target=pump, args=(target, client), daemon=True),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
    except OSError:
        pass
    finally:
        try:
            client.close()
        except OSError:
            pass
        if target is not None:
            try:
                target.close()
            except OSError:
                pass


def main() -> None:
    server = socket.socket()
    server.bind((LISTEN_HOST, LISTEN_PORT))
    server.listen(64)
    print(f"relay listening on {LISTEN_HOST}:{LISTEN_PORT} -> {TARGET_HOST}:{TARGET_PORT}", flush=True)
    while True:
        client, addr = server.accept()
        threading.Thread(target=handle, args=(client, addr), daemon=True).start()


if __name__ == "__main__":
    main()