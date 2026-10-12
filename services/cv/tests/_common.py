import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
FIXTURES = os.path.join(ROOT, "fixtures")

# Keep trained test models out of the real store.
os.environ.setdefault("MODEL_STORE_DIR", tempfile.mkdtemp(prefix="vitra-cv-test-models-"))


def fixture(name: str) -> bytes:
    with open(os.path.join(FIXTURES, name), "rb") as f:
        return f.read()
