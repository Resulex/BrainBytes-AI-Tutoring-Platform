// k6 performance test suite for BrainBytes backend API
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const authRequests = new Counter('auth_requests');
const apiRequestDuration = new Trend('api_request_duration', true);

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 2 }, // Ramp up to 2 users
    { duration: '1m', target: 5 }, // Ramp up to 5 users
    { duration: '30s', target: 5 }, // Stay at 5 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests under 5s (AI responses are slow)
    http_req_failed: ['rate<0.50'], // Less than 50% failure (auth rate limits will cause failures)
    errors: ['rate<0.50'], // Less than 50% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Group: Health check
  group('GET / (Health Check)', () => {
    const res = http.get(`${BASE_URL}/`, {
      tags: { type: 'health' },
    });
    const passed = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!passed);
    apiRequestDuration.add(res.timings.duration);
    sleep(1);
  });

  // Group: Registration
  const testUser = {
    email: `perf-test-${__VU}-${__ITER}@brainbytes.com`,
    password: 'TestPass123!',
    name: `perfuser${__VU}${__ITER}`,
  };

  group('POST /api/auth/register', () => {
    const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(testUser), {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'auth' },
    });
    var statusOk = (function () {
      return res.status === 201 || res.status === 400;
    })();
    var timingOk = res.timings.duration < 2000;
    var passed = check(res, {
      'registration status is 201 or 400': function () {
        return statusOk;
      },
      'registration response time < 2s': function () {
        return timingOk;
      },
    });
    errorRate.add(!passed);
    authRequests.add(1);
    apiRequestDuration.add(res.timings.duration);
    sleep(1);
  });

  // Group: Login
  let authToken = null;
  group('POST /api/auth/login', () => {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'auth' },
      },
    );
    const passed = check(res, {
      'login status is 200': (r) => r.status === 200,
      'login returns token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.token !== undefined;
        } catch (e) {
          return false;
        }
      },
      'login response time < 2s': (r) => r.timings.duration < 2000,
    });
    errorRate.add(!passed);
    authRequests.add(1);
    apiRequestDuration.add(res.timings.duration);

    if (res.status === 200) {
      try {
        authToken = JSON.parse(res.body).token;
      } catch (e) {
        // ignore
      }
    }
    sleep(1);
  });

  // Group: Authenticated requests
  if (authToken) {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };

    group('GET /api/users (Authenticated)', () => {
      const res = http.get(`${BASE_URL}/api/users`, {
        headers: authHeaders,
        tags: { type: 'api' },
      });
      var usersStatusOk = function () {
        return res.status === 200 || res.status === 404;
      };
      var usersTimingOk = res.timings.duration < 2000;
      var passed = check(res, {
        'users endpoint responds': usersStatusOk,
        'users response time < 2s': function () {
          return usersTimingOk;
        },
      });
      errorRate.add(!passed);
      apiRequestDuration.add(res.timings.duration);
      sleep(1);
    });

    group('GET /api/sessions (Authenticated)', () => {
      const res = http.get(`${BASE_URL}/api/sessions`, {
        headers: authHeaders,
        tags: { type: 'api' },
      });
      var sessionsStatusOk = function () {
        return res.status === 200 || res.status === 404;
      };
      var sessionsTimingOk = res.timings.duration < 2000;
      var passed = check(res, {
        'sessions endpoint responds': sessionsStatusOk,
        'sessions response time < 2s': function () {
          return sessionsTimingOk;
        },
      });
      errorRate.add(!passed);
      apiRequestDuration.add(res.timings.duration);
      sleep(1);
    });

    group('GET /api/materials (Authenticated)', () => {
      const res = http.get(`${BASE_URL}/api/materials`, {
        headers: authHeaders,
        tags: { type: 'api' },
      });
      var materialsStatusOk = function () {
        return res.status === 200 || res.status === 404;
      };
      var materialsTimingOk = res.timings.duration < 2000;
      var passed = check(res, {
        'materials endpoint responds': materialsStatusOk,
        'materials response time < 2s': function () {
          return materialsTimingOk;
        },
      });
      errorRate.add(!passed);
      apiRequestDuration.add(res.timings.duration);
      sleep(1);
    });
  }

  sleep(2);
}

export function handleSummary(data) {
  // Safe accessor — k6's goja runtime does not support optional chaining (?.)
  var m = (data && data.metrics) || {};
  var root = data && data.root_group;

  var totalRequests = (m.http_reqs && m.http_reqs.values && m.http_reqs.values.count) || 0;
  var failedRequests =
    (m.http_req_failed && m.http_req_failed.values && m.http_req_failed.values.rate) || 0;
  var avgDuration =
    (m.http_req_duration && m.http_req_duration.values && m.http_req_duration.values.avg) || 0;
  var p95Duration =
    (m.http_req_duration && m.http_req_duration.values && m.http_req_duration.values['p(95)']) || 0;
  var p99Duration =
    (m.http_req_duration && m.http_req_duration.values && m.http_req_duration.values['p(99)']) || 0;
  var maxDuration =
    (m.http_req_duration && m.http_req_duration.values && m.http_req_duration.values.max) || 0;
  var errorRateVal = (m.errors && m.errors.values && m.errors.values.rate) || 0;
  var vus = (m.vus && m.vus.values && m.vus.values.value) || 0;
  var iterations = (m.iterations && m.iterations.values && m.iterations.values.count) || 0;

  var checks = (root && root.checks) || [];
  var checksPassed = checks.reduce(function (acc, c) {
    return acc + (c.passes || 0);
  }, 0);
  var checksTotal = checks.reduce(function (acc, c) {
    return acc + (c.passes || 0) + (c.fails || 0);
  }, 0);

  var thresholds = null;
  if (m.http_req_duration && m.http_req_duration.thresholds) {
    thresholds = m.http_req_duration.thresholds['p(95)<5000'];
  }
  var thresholdsPassed = !(thresholds && thresholds.ok === false);

  // Generate a JSON summary for CI integration
  var summary = {
    timestamp: new Date().toISOString(),
    totalRequests: totalRequests,
    failedRequests: failedRequests,
    avgDuration: avgDuration,
    p95Duration: p95Duration,
    p99Duration: p99Duration,
    maxDuration: maxDuration,
    errorRate: errorRateVal,
    vus: vus,
    iterations: iterations,
    checksPassed: checksPassed,
    checksTotal: checksTotal,
    thresholdsPassed: thresholdsPassed,
  };

  return {
    stdout: JSON.stringify(summary, null, 2) + '\n',
  };
}
