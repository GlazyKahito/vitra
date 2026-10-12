import unittest

import numpy as np

from tests._common import ROOT  # noqa: F401
from vitra_cv.config import ANALYTE_KEYS
from vitra_cv.quality import sniff_format
from vitra_cv.synthetic import demo_color, render_strip, synthetic_dataset


class SyntheticTests(unittest.TestCase):
    def test_render_is_png_and_deterministic(self):
        a = render_strip(seed=3, width=800, height=300)
        b = render_strip(seed=3, width=800, height=300)
        self.assertEqual(sniff_format(a), "png")
        self.assertEqual(a, b)
        self.assertNotEqual(a, render_strip(seed=4, width=800, height=300))

    def test_render_array_shape_and_rotation(self):
        img = render_strip(seed=1, width=800, height=300, return_array=True)
        self.assertEqual(img.shape, (300, 800, 3))
        img90 = render_strip(seed=1, width=300, height=800, rotation_deg=90, return_array=True)
        self.assertEqual(img90.shape, (800, 300, 3))

    def test_demo_color_endpoints(self):
        self.assertTrue(np.allclose(demo_color("glucose", 0.0), [0x7E, 0xC8, 0xC0]))
        self.assertTrue(np.allclose(demo_color("glucose", 1.0), [0x7A, 0x5A, 0x2C]))

    def test_dataset_columns(self):
        df = synthetic_dataset(30, seed=2)
        self.assertEqual(len(df), 30)
        for c in ["sample_id", "strip_product", "batch", "synthetic", "split", "p01_r", "p10_b", "p01_l", "p10_bb"]:
            self.assertIn(c, df.columns)
        for k in ANALYTE_KEYS:
            self.assertIn(f"ref_{k}", df.columns)
        self.assertTrue(df["synthetic"].all())
        self.assertEqual(set(df["strip_product"]), {"SYN-10P"})
        self.assertEqual(df["batch"].nunique(), 3)
        self.assertEqual(df["sample_id"].nunique(), 30)


if __name__ == "__main__":
    unittest.main()
