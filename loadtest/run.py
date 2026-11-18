"""Local fixture benchmark. Never accepts a production URL or production credentials."""
import argparse
import base64
import concurrent.futures
import hashlib
import hmac
import json
import os
from pathlib import Path
import subprocess
import threading
import time
import urllib.error
import urllib.request
from report import read_summary

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / 'loadtest' / 'results'
COMPOSE = ['docker', 'compose', '-f', str(ROOT / 'loadtest' / 'compose.yaml')]
LOCAL = 'http://127.0.0.1:18080'


def command(args, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=True, **kwargs)


def identity_files():
    RESULTS.mkdir(exist_ok=True)
    secret = b'local-loadtest-only-do-not-use-in-production-01234567890123456789'
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).rstrip(b'=')
    users = []
    for user in range(1, 201):
        now = int(time.time())
        payload = encode({'alg': 'HS512', 'typ': 'JWT'}) + b'.' + encode({'sub': str(user), 'type': 'access', 'iat': now, 'exp': now + 86400})
        signature = base64.urlsafe_b64encode(hmac.new(secret, payload, hashlib.sha512).digest()).rstrip(b'=')
        users.append({'id': user, 'token': (payload + b'.' + signature).decode()})
    (RESULTS / 'users.json').write_text(json.dumps(users), encoding='utf-8')
    return users


def request(path, user=None, method='GET'):
    headers = {'Authorization': 'Bearer ' + user['token']} if user else {}
    req = urllib.request.Request(LOCAL + path, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.status, dict(response.headers), json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers), json.load(error)


def ready():
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        try:
            if request('/actuator/health/readiness')[0] == 200:
                return
        except (OSError, ValueError):
            pass
        time.sleep(2)
    raise RuntimeError('Fixture server did not become ready; inspect docker compose logs backend')


def start(enabled, reset=False):
    env = dict(os.environ, LOADTEST_LIMITS_ENABLED=str(enabled).lower())
    command(COMPOSE + ['up', '-d'] + (['--force-recreate'] if reset else []) + ['backend'], env=env)
    ready()


def smoke(users):
    for path in ['/api/posts', '/api/posts?sort=popular', '/api/posts?q=%EC%82%B0%EC%B1%85', '/api/posts/1',
                 '/api/posts/1/comments', '/api/analysis/latest', '/api/analysis/history']:
        status, _, body = request(path, users[0])
        if status != 200:
            raise RuntimeError(f'Smoke failed: {path} returned {status}: {body}')
    status, _, data = request('/api/analysis', users[0], 'POST')
    if status != 200 or not data.get('character') or len(data.get('recommendedArtists', [])) != 3 or not data['profile']['comment']:
        raise RuntimeError(f'Mocked full analysis smoke failed: {status}')
    print('SMOKE_PASS: non-empty read endpoints and full analysis with 3 artist recommendations', flush=True)


def samples(stop, records):
    while not stop.is_set():
        try:
            ids = subprocess.check_output(['docker', 'ps', '--filter', 'label=com.docker.compose.project=musicpets-loadtest', '--format', '{{.ID}}'], text=True, timeout=10).split()
            text = subprocess.check_output(['docker', 'stats', '--no-stream', '--format', '{{json .}}', *ids], text=True, timeout=12)
            records.append({'at': time.time(), 'containers': [json.loads(line) for line in text.splitlines()]})
        except (subprocess.SubprocessError, OSError):
            pass
        stop.wait(3)


def measure(args, users):
    start(False)
    smoke(users)
    stamp = time.strftime('%Y%m%d-%H%M%S')
    records = []
    stop = threading.Event()
    sampler = threading.Thread(target=samples, args=(stop, records), daemon=True)
    sampler.start()
    rows = []
    try:
        for label, rate, duration in [('warmup', 5 if args.mode == 'read' else 1, '30s')] + [(f'{args.mode}-{rate}rps-{stamp}', rate, args.duration) for rate in args.rates]:
            print(f'RUN {label}: {rate} workflow/s for {duration}', flush=True)
            with (RESULTS / (label + '.log')).open('w', encoding='utf-8') as log:
                process = subprocess.run(COMPOSE + ['run', '--rm', '-T', '-e', f'MODE={args.mode}', '-e', f'RATE={rate}',
                    '-e', f'DURATION={duration}', '-e', f'LABEL={label}', 'k6', 'run', 'workload.js'], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
            path = RESULTS / (label + '.json')
            if not path.exists():
                raise RuntimeError(f'k6 produced no summary; see {label}.log')
            row = read_summary(path, 2000 if args.mode == 'analysis' else 500)
            row.update({'label': label, 'target_workflow_rps': rate, 'mode': args.mode, 'k6_exit': process.returncode})
            if label == 'warmup':
                if process.returncode: raise RuntimeError('Warmup failed; inspect results/warmup.log')
                continue
            rows.append(row)
            print(json.dumps(row, ensure_ascii=False), flush=True)
            if process.returncode:
                print('Stopped increasing load after the first failed performance threshold.', flush=True)
                break
    finally:
        stop.set(); sampler.join(timeout=15)
        (RESULTS / f'{args.mode}-{stamp}-stats.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
        (RESULTS / f'{args.mode}-{stamp}-report.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
    return rows


def verify_limits(users):
    rows = []
    for scenario in ['account', 'shared_ip', 'analysis']:
        start(True, reset=True)  # Clean in-memory budgets, same fixture database.
        if scenario == 'analysis':
            codes = [request('/api/analysis', users[0], 'POST')[0] for _ in range(2)]
            if codes != [200, 429]: raise RuntimeError(f'Analysis limit failed: {codes}')
        else:
            def visit(i):
                status, headers, _ = request('/api/analysis/latest', users[0] if scenario == 'account' else users[i % 200])
                if status == 429 and int(headers.get('Retry-After', '0')) < 1:
                    raise RuntimeError('429 without a usable Retry-After')
                return status
            for i in range(10):
                if request('/api/analysis/latest', users[i])[0] != 200:
                    raise RuntimeError('Normal browsing was rejected before the burst')
            with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
                if scenario == 'shared_ip':
                    normal = list(pool.map(lambda i: visit(i % 30), range(360)))
                    if any(code != 200 for code in normal):
                        raise RuntimeError('Thirty users making twelve reads each were rejected')
                codes = list(pool.map(visit, range(180 if scenario == 'account' else 1000)))
            if 200 not in codes or 429 not in codes or any(code not in [200, 429] for code in codes):
                raise RuntimeError(f'{scenario} limit verification failed: {set(codes)}')
        row = {'scenario': scenario, 'ok': codes.count(200), 'limited': codes.count(429)}
        if scenario == 'shared_ip': row['normal_reads_ok'] = 360
        rows.append(row); print(json.dumps(row), flush=True)
    (RESULTS / 'limits-verification.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'measure', 'verify', 'stop'])
    parser.add_argument('--mode', choices=['read', 'analysis'], default='read')
    parser.add_argument('--rates', nargs='+', type=int, default=[5, 10, 20, 40, 80])
    parser.add_argument('--duration', default='60s')
    args = parser.parse_args()
    if args.action == 'stop':
        command(COMPOSE + ['down'])  # Only musicpets-loadtest; its dedicated fixture volume is retained.
        return
    users = identity_files()
    if args.action == 'prepare':
        wrapper = ['cmd', '/c', 'gradlew.bat'] if os.name == 'nt' else ['./gradlew']
        subprocess.run(wrapper + ['--no-daemon', 'loadTestJar'], cwd=ROOT / 'backend', check=True)
        start(False)
        # Refresh only seeded posts, including when prepare reuses last week's fixture volume.
        command(COMPOSE + ['exec', '-T', 'mysql', 'mysql', '-umusicpets_loadtest', '-plocal-loadtest-only',
            'musicpets_loadtest', '-e', "UPDATE posts SET created_at = UTC_TIMESTAMP() - INTERVAL MOD(id, 28) DAY, "
            "updated_at = created_at WHERE track_uri = CONCAT('spotify:track:fixture', id)"])
        smoke(users)
    elif args.action == 'measure':
        rows = measure(args, users)
        if any(row['k6_exit'] for row in rows):
            raise SystemExit(99)
    else:
        verify_limits(users)


if __name__ == '__main__':
    main()
