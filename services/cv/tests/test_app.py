import os
import unittest

from starlette.testclient import TestClient

from tests._common import fixture
from vitra_cv.app import create_app
from vitra_cv.quality import sniff_format


class AppTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("CV_SERVICE_TOKEN", None)
        self.client = TestClient(create_app())

    def test_health(self):
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["service"], "vitra-cv")
        self.assertEqual(body["status"], "ok")
        self.assertIn("opencv_version", body)

    def test_analyze_fixture(self):
        r = self.client.post("/v1/analyze", files={"file": ("s.png", fixture("synthetic_strip_02.png"), "image/png")},
                             data={"config": '{"handle_side": "auto"}'})
        self.assertEqual(r.status_code, 200, r.text[:300])
        body = r.json()
        self.assertTrue(body["quality"]["passed"])
        self.assertEqual(len(body["pads"]), 10)
        self.assertTrue(body["overlay_png_base64"])

    def test_analyze_bad_config_and_format(self):
        r = self.client.post("/v1/analyze", files={"file": ("s.png", fixture("synthetic_strip_01.png"), "image/png")},
                             data={"config": '{"pad_count": 2}'})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["code"], "invalid_config")
        r = self.client.post("/v1/analyze", files={"file": ("s.txt", b"hello", "text/plain")})
        self.assertEqual(r.status_code, 415)
        self.assertEqual(r.json()["error"]["code"], "unsupported_format")

    def test_synthetic_strip_png(self):
        r = self.client.post("/v1/synthetic/strip", json={"seed": 3, "width": 800, "height": 300, "levels": {"glucose": 0.5}})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["content-type"], "image/png")
        self.assertEqual(sniff_format(r.content), "png")

    def test_validate_and_infer_errors(self):
        r = self.client.post("/v1/calibration/validate", json={"csv_text": "sample_id,p01_r\nA,1\n", "pad_count": 10})
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["ok"])
        r = self.client.post("/v1/infer", json={"model_id": "nope", "rgb_30": [0.0] * 30})
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json()["error"]["code"], "model_not_found")

    def test_token_enforcement(self):
        os.environ["CV_SERVICE_TOKEN"] = "secret-123"
        try:
            client = TestClient(create_app())
            self.assertEqual(client.get("/health").status_code, 200)  # health is open
            r = client.post("/v1/synthetic/strip", json={"seed": 1, "width": 320, "height": 120})
            self.assertEqual(r.status_code, 401)
            self.assertEqual(r.json()["error"]["code"], "unauthorized")
            r = client.post("/v1/synthetic/strip", json={"seed": 1, "width": 320, "height": 120},
                            headers={"X-Vitra-Service-Token": "secret-123"})
            self.assertEqual(r.status_code, 200)
        finally:
            os.environ.pop("CV_SERVICE_TOKEN", None)


if __name__ == "__main__":
    unittest.main()
