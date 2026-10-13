"""Actual loopback HTTP and field-kit tests; not an Android device test."""
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen, Request

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from serve import ASSETS, make_server
from package_android import FILES, package


class AndroidToolsTest(unittest.TestCase):
    def setUp(self):
        self.server = make_server(0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def test_loopback_assets_and_manifest_mime(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")
        for name in ASSETS:
            with urlopen(self.url + "/" + name, timeout=3) as response:
                self.assertEqual(response.read(), (ROOT / name).read_bytes())
                if name == "manifest.webmanifest":
                    self.assertEqual(response.headers.get_content_type(), "application/manifest+json")
        with urlopen(self.url + "/", timeout=3) as response:
            self.assertIn(b"MED-LAB ZERO", response.read())

    def test_no_repo_directory_or_upload_endpoint(self):
        for route in ["/docs/", "/README.md", "/.git/config", "/history.json", "/%2e%2e/app.js"]:
            with self.assertRaises(HTTPError) as error:
                urlopen(self.url + route, timeout=3)
            self.assertEqual(error.exception.code, 404)
        with self.assertRaises(HTTPError) as error:
            urlopen(Request(self.url + "/", data=b"synthetic", method="POST"), timeout=3)
        self.assertEqual(error.exception.code, 501)

    def test_package_matches_source_and_has_no_personal_or_repo_files(self):
        with tempfile.TemporaryDirectory() as folder:
            target = package(Path(folder) / "kit")
            names = {str(p.relative_to(target)) for p in target.rglob("*") if p.is_file()}
            self.assertEqual(names, set(FILES))
            for name in FILES:
                self.assertEqual((target / name).read_bytes(), (ROOT / name).read_bytes())
            with self.assertRaises(FileExistsError):
                package(target)


if __name__ == "__main__":
    unittest.main()
