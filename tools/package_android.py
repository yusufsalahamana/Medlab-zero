"""Build an allowlisted field kit from this checked-out source; no user data."""
import argparse
import shutil
from pathlib import Path
from serve import ASSETS, ROOT

FILES = (*ASSETS, "tools/serve.py", "docs/ANDROID_TEST_PATH.md")


def package(destination):
    destination = Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=False)
    for name in FILES:
        source = ROOT / name
        if not source.is_file():
            raise FileNotFoundError(name)
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="dist/medlab-zero-android-test")
    args = parser.parse_args()
    print(package(args.output))
