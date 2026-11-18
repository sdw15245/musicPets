import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const BASE = __ENV.BASE_URL || 'http://backend:8080';
if (!/^http:\/\/(backend:8080|127\.0\.0\.1:18080|localhost:18080)$/.test(BASE))
  throw new Error('Only the isolated local load-test backend is allowed');
const users = JSON.parse(open('./results/users.json'));
const successful = new Counter('successful');
const limited = new Counter('rate_limited');
const serverErrors = new Counter('server_errors');
const otherErrors = new Counter('other_errors');
const workflowTime = new Trend('workflow_ms', true);
const mode = __ENV.MODE || 'read';
if (!['read', 'analysis'].includes(mode)) throw new Error('Unsupported MODE');
const rate = Number(__ENV.RATE || 5);
export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: { workload: { executor: 'constant-arrival-rate', rate, timeUnit: '1s', duration: __ENV.DURATION || '20s',
    preAllocatedVUs: Math.min(100, Math.max(10, rate)), maxVUs: 200, gracefulStop: '10s' } },
  thresholds: __ENV.LABEL === 'warmup' ? {checks: ['rate>0.99']} : {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '10s' }],
    checks: ['rate>0.99'], dropped_iterations: ['count==0'],
    http_req_duration: [`p(95)<${mode === 'analysis' ? 2000 : 500}`],
    ...Object.fromEntries((mode === 'read' ? ['latest', 'popular', 'search', 'detail', 'comments', 'latest_analysis', 'history'] : [])
      .map(endpoint => [`http_req_duration{endpoint:${endpoint}}`, ['p(95)<500']])),
  },
};
function record(response, valid) {
  if (response.status === 429) limited.add(1);
  else if (response.status >= 500) serverErrors.add(1);
  else if (response.status === 200 && valid) successful.add(1);
  else otherErrors.add(1);
  check(response, { '200 with expected data': r => r.status === 200 && valid });
}
function get(path, params, validate) {
  const response = http.get(BASE + path, params);
  let valid = false;
  try { valid = validate(response.json()); } catch (_) { /* counted below */ }
  record(response, valid);
}
export default function () {
  const user = users[exec.scenario.iterationInTest % users.length];
  const params = { headers: { Authorization: `Bearer ${user.token}` }, timeout: '10s' };
  const started = Date.now();
  if (mode === 'read') {
    const kind = exec.scenario.iterationInTest % 7;
    const page = exec.scenario.iterationInTest % 5;
    if (kind === 0) get(`/api/posts?page=${page}`, {...params, tags: {endpoint: 'latest'}}, d => d.items?.length === 20);
    if (kind === 1) get('/api/posts?sort=popular', {...params, tags: {endpoint: 'popular'}}, d => d.items?.length === 20);
    if (kind === 2) get('/api/posts?q=' + encodeURIComponent('산책'), {...params, tags: {endpoint: 'search'}}, d => d.items?.length === 20);
    if (kind === 3) get('/api/posts/' + (exec.scenario.iterationInTest % 5000 + 1), {...params, tags: {endpoint: 'detail'}}, d => !!d.track?.uri);
    if (kind === 4) get('/api/posts/1/comments', {...params, tags: {endpoint: 'comments'}}, d => d.items?.length > 0);
    if (kind === 5) get('/api/analysis/latest', {...params, tags: {endpoint: 'latest_analysis'}}, d => !!d.character?.slug);
    if (kind === 6) get('/api/analysis/history', {...params, tags: {endpoint: 'history'}}, d => Array.isArray(d) && d.length > 0);
  } else {
    const core = http.post(BASE + '/api/analysis', null, {...params, headers: {...params.headers, 'X-Analysis-Mode': 'progressive'}, tags: {endpoint: 'analysis_core'}});
    let result;
    try { result = core.json(); } catch (_) { /* counted below */ }
    record(core, !!result?.character?.slug && result.genres?.trackCount === 20);
    if (core.status === 200 && result?.id) {
      const prefix = BASE + '/api/analysis/' + result.id;
      const responses = http.batch([
        ['POST', prefix + '/profile', null, {...params, tags: {endpoint: 'analysis_profile'}}],
        ['POST', prefix + '/recommendations/initial', null, {...params, tags: {endpoint: 'analysis_recommendations'}}],
      ]);
      for (let i = 0; i < responses.length; i++) {
        let data;
        try { data = responses[i].json(); } catch (_) { /* counted below */ }
        record(responses[i], i === 0 ? !!data?.profile?.comment && data.profilePending === false
          : data?.recommendedArtists?.length === 3 && data.recommendationsPending === false);
      }
    }
  }
  workflowTime.add(Date.now() - started);
}
export function handleSummary(data) {
  return { [`results/${__ENV.LABEL || mode}.json`]: JSON.stringify(data, null, 2) };
}
