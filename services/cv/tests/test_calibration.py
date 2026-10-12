import os
import unittest

import pandas as pd

from tests._common import FIXTURES
from vitra_cv.calibration import CalibrationError, infer, train, validate_dataset
from vitra_cv.synthetic import synthetic_dataset

CSV_PATH = os.path.join(FIXTURES, "synthetic_calibration_v1.csv")


class CalibrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(CSV_PATH) as f:
            cls.csv = f.read()
        cls.df = pd.read_csv(CSV_PATH)

    def test_validate_ok(self):
        v = validate_dataset(self.csv, 10)
        self.assertTrue(v["ok"], v["issues"])
        self.assertEqual(v["rows"], 240)
        self.assertEqual(v["synthetic_rows"], 240)
        self.assertEqual(v["per_analyte_counts"]["glucose"], 240)
        self.assertEqual(v["missing_required"], [])

    def test_validate_catches_missing_column_and_duplicate(self):
        df = self.df.drop(columns=["p05_g"]).copy()
        df = pd.concat([df, df.iloc[[0]]], ignore_index=True)
        v = validate_dataset(df.to_csv(index=False), 10)
        self.assertFalse(v["ok"])
        self.assertIn("p05_g", v["missing_required"])
        self.assertEqual(v["duplicate_rows"], 1)
        self.assertIn(str(df.iloc[0]["sample_id"]), v["duplicate_sample_ids"])

    def test_train_poly2_glucose(self):
        r = train(self.csv, "glucose", "mg/dL", "poly2_ridge", "rgb30", None, 0.25, 42, "test-glucose-poly2")
        self.assertEqual(r["model_id"], "test-glucose-poly2")
        self.assertGreater(r["metrics"]["test"]["r2"], 0.7)
        self.assertGreater(r["n_test"], 0)
        self.assertEqual(r["n_train"] + r["n_test"], 240)
        self.assertEqual(r["synthetic_fraction"], 1.0)
        self.assertIn("p95", r["residual_quantiles"])
        self.assertEqual(len(r["predictions"]), 240)
        # no sample_id in both splits
        tr = {p["sample_id"] for p in r["predictions"] if p["split"] == "train"}
        te = {p["sample_id"] for p in r["predictions"] if p["split"] == "test"}
        self.assertEqual(tr & te, set())
        store = os.environ["MODEL_STORE_DIR"]
        self.assertTrue(os.path.exists(os.path.join(store, "test-glucose-poly2.joblib")))
        self.assertTrue(os.path.exists(os.path.join(store, "test-glucose-poly2.json")))

        row = self.df.iloc[3]
        rgb = [float(row[f"p{i:02d}_{c}"]) for i in range(1, 11) for c in "rgb"]
        out = infer("test-glucose-poly2", rgb, None)
        self.assertEqual(out["analyte"], "glucose")
        self.assertTrue(out["synthetic_training_data"])
        self.assertIsNotNone(out["interval_95"])
        self.assertLessEqual(out["interval_95"][0], out["value"])
        self.assertLessEqual(abs(out["value"] - float(row["ref_glucose"])), 200)

    def test_pad_rgb_feature_set(self):
        r = train(self.csv, "ph", None, "linear", "pad_rgb", 2, 0.25, 1, "test-ph-pad")
        self.assertEqual(r["unit"], "pH")
        self.assertGreater(r["metrics"]["test"]["r2"], 0.5)

    def test_insufficient_data_raises(self):
        small = synthetic_dataset(12, seed=9).to_csv(index=False)
        with self.assertRaises(CalibrationError) as cm:
            train(small, "glucose", "mg/dL", "linear", "rgb30")
        self.assertEqual(cm.exception.code, "insufficient_data")

    def test_model_not_found_and_feature_mismatch(self):
        with self.assertRaises(CalibrationError) as cm:
            infer("does-not-exist", [0.0] * 30, None)
        self.assertEqual(cm.exception.code, "model_not_found")
        train(self.csv, "protein", None, "linear", "rgb30", None, 0.25, 1, "test-protein-lin")
        with self.assertRaises(CalibrationError) as cm:
            infer("test-protein-lin", [1.0, 2.0], None)
        self.assertEqual(cm.exception.code, "feature_mismatch")


if __name__ == "__main__":
    unittest.main()
