import unittest

from tests._common import fixture
from vitra_cv.config import PadConfig, parse_config, ConfigError
from vitra_cv.pipeline import PipelineError, analyze
from vitra_cv.synthetic import render_strip


def check(result, cid):
    return next(c for c in result["quality"]["checks"] if c["id"] == cid)


class PipelineTests(unittest.TestCase):
    def test_good_fixture_passes(self):
        r = analyze(fixture("synthetic_strip_01.png"))
        self.assertTrue(r["quality"]["passed"], [c for c in r["quality"]["checks"] if c["status"] != "pass"])
        self.assertEqual(len(r["pads"]), 10)
        self.assertEqual(len(r["feature_vector"]["rgb_30"]), 30)
        self.assertEqual(len(r["feature_vector"]["lab_30"]), 30)
        self.assertEqual([p["pad_id"] for p in r["pads"]][:2], ["P01", "P02"])
        self.assertEqual(r["pads"][0]["analyte"], "glucose")
        self.assertTrue(r["strip"]["found"])
        self.assertEqual(len(r["strip"]["polygon"]), 4)
        self.assertEqual(len(r["image"]["sha256"]), 64)
        self.assertEqual(set(r["timings_ms"]), {"decode", "quality", "localize", "segment", "features", "total"})
        self.assertEqual([c["id"] for c in r["quality"]["checks"]],
                         ["format", "resolution", "blur", "overexposure", "underexposure",
                          "strip_visible", "orientation", "obstruction", "pads_visible"])

    def test_glucose_pad_colour_tracks_level(self):
        lo = analyze(render_strip(seed=21, levels={"glucose": 0.05}, width=1200, height=450))
        hi = analyze(render_strip(seed=21, levels={"glucose": 0.95}, width=1200, height=450))
        lo_rgb = lo["pads"][0]["features"]["rgb_mean"]
        hi_rgb = hi["pads"][0]["features"]["rgb_mean"]
        # ramp goes #7ec8c0 (teal) -> #7a5a2c (brown): blue and green channels drop sharply
        self.assertGreater(lo_rgb[2] - hi_rgb[2], 80)
        self.assertGreater(lo_rgb[1] - hi_rgb[1], 60)

    def test_blurry_fails_blur(self):
        r = analyze(fixture("synthetic_strip_04.png"))
        self.assertEqual(check(r, "blur")["status"], "fail")
        self.assertFalse(r["quality"]["passed"])

    def test_overexposed_fails(self):
        r = analyze(fixture("synthetic_strip_05.png"))
        self.assertEqual(check(r, "overexposure")["status"], "fail")
        self.assertFalse(r["quality"]["passed"])

    def test_rotated_90_still_ten_pads(self):
        r = analyze(fixture("synthetic_strip_06.png"))
        self.assertTrue(r["strip"]["rotated_90"])
        self.assertEqual(len(r["pads"]), 10)
        self.assertEqual(len(r["feature_vector"]["rgb_30"]), 30)

    def test_upside_down_is_flipped(self):
        r = analyze(render_strip(seed=5, rotation_deg=180, width=1200, height=450))
        self.assertTrue(r["strip"]["flipped"])
        self.assertEqual(len(r["pads"]), 10)

    def test_fixed_geometry_mode(self):
        cfg = PadConfig(geometry={"mode": "fixed"})
        r = analyze(fixture("synthetic_strip_02.png"), cfg)
        self.assertEqual(len(r["pads"]), 10)
        self.assertTrue(all(p["roi_source"] == "fixed" for p in r["pads"]))

    def test_errors(self):
        with self.assertRaises(PipelineError) as cm:
            analyze(b"not an image at all")
        self.assertEqual(cm.exception.code, "unsupported_format")
        with self.assertRaises(PipelineError) as cm:
            analyze(b"\x89PNG\r\n\x1a\n" + b"\x00" * 40)
        self.assertEqual(cm.exception.code, "decode_failed")
        with self.assertRaises(ConfigError):
            parse_config('{"pad_count": 3}')  # pad_map length mismatch


if __name__ == "__main__":
    unittest.main()
