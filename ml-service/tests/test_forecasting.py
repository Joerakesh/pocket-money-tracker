import unittest

import numpy as np

from app.main import (
    ForecastRequest,
    evaluate_models,
    moving_average_predict,
    predict_spending,
    regression_predict,
)


class ForecastTests(unittest.TestCase):
    def test_moving_average_is_non_negative_and_constant(self):
        result = moving_average_predict(np.array([100.0, 200.0, 300.0]), 4)
        self.assertEqual(result.tolist(), [200.0, 200.0, 200.0, 200.0])

    def test_regression_does_not_return_negative_predictions(self):
        result = regression_predict(np.array([100.0, 50.0, 0.0, 0.0]), 5)
        self.assertTrue(np.all(result >= 0))

    def test_evaluation_uses_available_candidates(self):
        values = np.array([1000.0 + (i % 5) * 100 for i in range(100)])
        scores, selected = evaluate_models(values)
        self.assertIn(selected, scores)
        self.assertIn("moving_average", scores)
        self.assertIn("linear_regression", scores)
        self.assertIn("random_forest", scores)

    def test_api_result_keeps_paise_and_does_not_touch_ledger(self):
        payload = ForecastRequest(
            daily_spending_paise=[10000, 0, 12000, 8000, 0, 15000, 11000] * 15,
            forecast_days=30,
        )
        result = predict_spending(payload)
        self.assertEqual(len(result["daily_predictions_paise"]), 30)
        self.assertGreaterEqual(result["predicted_total_paise"], 0)
        self.assertFalse(result["ledger_mutated"])
        self.assertEqual(result["currency"], "INR")


if __name__ == "__main__":
    unittest.main()
