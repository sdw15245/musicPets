import unittest
from report import assess


class ResultTests(unittest.TestCase):
    def test_fast_rejections_are_not_successful_capacity(self):
        result = assess({'successful': 5, 'rate_limited': 95, 'server_errors': 0,
                         'other_errors': 0, 'dropped': 0, 'p95_ms': 5, 'duration_s': 10})
        self.assertFalse(result['pass'])
        self.assertEqual(result['successful_rps'], 0.5)

    def test_dropped_work_invalidates_requested_capacity(self):
        result = assess({'successful': 100, 'rate_limited': 0, 'server_errors': 0,
                         'other_errors': 0, 'dropped': 10, 'p95_ms': 100, 'duration_s': 10})
        self.assertFalse(result['pass'])

    def test_slow_valid_responses_fail_latency_goal(self):
        result = assess({'successful': 100, 'rate_limited': 0, 'server_errors': 0,
                         'other_errors': 0, 'dropped': 0, 'p95_ms': 1200, 'duration_s': 10})
        self.assertFalse(result['pass'])

    def test_only_successful_completed_requests_count(self):
        result = assess({'successful': 200, 'rate_limited': 0, 'server_errors': 0,
                         'other_errors': 0, 'dropped': 0, 'p95_ms': 200, 'duration_s': 20})
        self.assertTrue(result['pass'])
        self.assertEqual(result['successful_rps'], 10)


if __name__ == '__main__':
    unittest.main()
