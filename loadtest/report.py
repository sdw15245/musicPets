"""Summarize completed, valid requests; 429 responses never count as throughput."""
import json
from pathlib import Path


def assess(row, goal_ms=500):
    total = sum(row[k] for k in ('successful', 'rate_limited', 'server_errors', 'other_errors'))
    return {**row, 'successful_rps': row['successful'] / max(row['duration_s'], .001),
            'pass': total > 0 and (total - row['successful']) / total < .01
                    and row['dropped'] == 0 and row['p95_ms'] < goal_ms}


def read_summary(path, goal_ms=500):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    metrics = data['metrics']
    def metric(name, key='count'):
        return metrics.get(name, {}).get('values', {}).get(key, 0)
    return assess({'successful': metric('successful'), 'rate_limited': metric('rate_limited'),
                   'server_errors': metric('server_errors'), 'other_errors': metric('other_errors'),
                   'dropped': metric('dropped_iterations'),
                   'p90_ms': metric('http_req_duration', 'p(90)'),
                   'p95_ms': metric('http_req_duration', 'p(95)'),
                   'p99_ms': metrics.get('http_req_duration', {}).get('values', {}).get('p(99)'),
                   'workflow_p95_ms': metric('workflow_ms', 'p(95)'),
                   'duration_s': data['state']['testRunDurationMs'] / 1000}, goal_ms)
