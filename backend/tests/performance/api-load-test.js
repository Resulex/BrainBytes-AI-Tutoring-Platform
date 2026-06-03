// k6 performance test suite for BrainBytes backend API
import http from 'k6/http';
import { check, sleep, group, trend } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const authRequests = new Counter('auth_requests');
const apiRequestDuration = new trend('api_request_duration', true);

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 }, // Ramp up to 5 users
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 }, // Stay at 20 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.10'], // Less than 10% failure rate
    errors: ['rate<0.10'], // Less than 10% error rate
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
    username: `perfuser${__VU}${__ITER}`,
  };

  group('POST /api/auth/register', () => {
    const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(testUser), {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'auth' },
    });
    const passed = check(res, {
      'registration responds': (r) => [201, 409].includes(r.status()),
      'registration response time < 2s': (r) => r.timings.duration < 2000,
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
      const passed = check(res, {
        'users endpoint responds': (r) => [200, 404].includes(r.status()),
        'users response time < 2s': (r) => r.timings.duration < 2000,
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
      const passed = check(res, {
        'sessions endpoint responds': (r) => [200, 404].includes(r.status()),
        'sessions response time < 2s': (r) => r.timings.duration < 2000,
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
      const passed = check(res, {
        'materials endpoint responds': (r) => [200, 404].includes(r.status()),
        'materials response time < 2s': (r) => r.timings.duration < 2000,
      });
      errorRate.add(!passed);
      apiRequestDuration.add(res.timings.duration);
      sleep(1);
    });
  }

  sleep(2);
}

export function handleSummary(data) {
  // Generate a JSON summary for CI integration
  const summary = {
    timestamp: new Date().toISOString(),
    totalRequests: data.metrics.http_reqs?.values?.count || 0,
    failedRequests: data.metrics.http_req_failed?.values?.rate || 0,
    avgDuration: data.metrics.http_req_duration?.values?.avg || 0,
    p95Duration: data.metrics.http_req_duration?.values['p(95)'] || 0,
    p99Duration: data.metrics.http_req_duration?.values['p(99)'] || 0,
    maxDuration: data.metrics.http_req_duration?.values?.max || 0,
    errorRate: data.metrics.errors?.values?.rate || 0,
    vus: data.metrics.vus?.values?.value || 0,
    iterations: data.metrics.iterations?.values?.count || 0,
    checksPassed: data.root_group?.checks?.reduce((acc, c) => acc + (c.passes || 0), 0) || 0,
    checksTotal:
      data.root_group?.checks?.reduce((acc, c) => acc + (c.passes || 0) + (c.fails || 0), 0) || 0,
    thresholdsPassed: !data.metrics.http_req_duration?.thresholds?.['p(95)<2000']?.ok === false,
  };

  return {
    stdout: `${JSON.stringify(summary, null, 2)}\n`,
    'tests/performance/summary.json': JSON.stringify(summary, null, 2),
  };
}
