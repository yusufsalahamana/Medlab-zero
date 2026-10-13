"""Phone-only loopback server; exposes app assets, not repo/history files."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
ASSETS = (
    "index.html", "app.js", "analysis.js", "pulse.js", "camera.js", "app.css", "manifest.webmanifest",
    "service-worker.js", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
)


class AppHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json"}

    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if route == "/":
            route = "/index.html"
        if route not in {"/" + name for name in ASSETS}:
            self.send_error(404)
            return
        self.path = route
        super().do_GET()

    def do_HEAD(self):
        self.send_error(405)

    def log_message(self, *args):
        pass  # No request or measurement log files.


def make_server(port=8765, root=ROOT):
    return ThreadingHTTPServer(("127.0.0.1", port), partial(AppHandler, directory=str(root)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with make_server(args.port) as server:
        print(f"MED-LAB ZERO: http://127.0.0.1:{server.server_port}/", flush=True)
        print("Buka alamat ini di Chrome pada HP yang sama. Ctrl+C untuk berhenti.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
