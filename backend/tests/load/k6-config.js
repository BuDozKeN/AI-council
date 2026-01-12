/**
 * k6 Load Testing Configuration
 *
 * Usage:
 *   Install k6: https://k6.io/docs/getting-started/installation/
 *   Run: k6 run backend/tests/load/k6-config.js
 *
 * Environment variables:
 *   BASE_URL: API base URL (default: http://localhost:8081)
 *   API_TOKEN: Bearer token for authenticated requests
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';

export const options = {
  // Stages for ramping up/down load (shorter for quick baseline)
  stages: [
    { duration: '15s', target: 10 },  // Ramp up to 10 users
    { duration: '30s', target: 10 },  // Stay at 10 users
    { duration: '15s', target: 25 },  // Ramp up to 25 users
    { duration: '30s', target: 25 },  // Stay at 25 users
    { duration: '10s', target: 0 },   // Ramp down to 0
  ],

  // Performance thresholds
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.05'],    // Error rate < 5%
    errors: ['rate<0.05'],             // Custom error rate < 5%
  },
};

// Test scenarios - Public endpoints (no auth required)
export default function () {
  // Liveness probe - should be very fast
  const liveRes = http.get(`${BASE_URL}/health/live`);
  check(liveRes, {
    'liveness status is 200': (r) => r.status === 200,
    'liveness latency < 50ms': (r) => r.timings.duration < 50,
  });
  apiLatency.add(liveRes.timings.duration);
  errorRate.add(liveRes.status !== 200);

  sleep(0.5);

  // Council stats - public endpoint
  const statsRes = http.get(`${BASE_URL}/api/v1/council-stats`);
  check(statsRes, {
    'council stats status is 200': (r) => r.status === 200,
    'council stats latency < 200ms': (r) => r.timings.duration < 200,
  });
  apiLatency.add(statsRes.timings.duration);
  errorRate.add(statsRes.status !== 200);

  sleep(0.5);

  // Billing plans - public, cacheable
  const plansRes = http.get(`${BASE_URL}/api/v1/billing/plans`);
  check(plansRes, {
    'billing plans status is 200': (r) => r.status === 200,
    'billing plans latency < 200ms': (r) => r.timings.duration < 200,
  });
  apiLatency.add(plansRes.timings.duration);
  errorRate.add(plansRes.status !== 200);

  sleep(0.5);

  // Full health check - includes DB connectivity
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check latency < 500ms': (r) => r.timings.duration < 500,
  });
  apiLatency.add(healthRes.timings.duration);
  errorRate.add(healthRes.status !== 200);

  sleep(0.5);
}

// Separate scenario for authenticated endpoints
export function authenticatedScenario() {
  const token = __ENV.API_TOKEN;
  if (!token) {
    console.log('Skipping authenticated tests - no API_TOKEN provided');
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // List conversations
  const conversationsRes = http.get(`${BASE_URL}/api/v1/conversations`, { headers });
  check(conversationsRes, {
    'conversations list status is 200': (r) => r.status === 200,
    'conversations list latency < 500ms': (r) => r.timings.duration < 500,
  });
  apiLatency.add(conversationsRes.timings.duration);
  errorRate.add(conversationsRes.status !== 200);

  sleep(2);

  // List businesses
  const businessesRes = http.get(`${BASE_URL}/api/v1/businesses`, { headers });
  check(businessesRes, {
    'businesses list status is 200': (r) => r.status === 200,
  });
  apiLatency.add(businessesRes.timings.duration);

  sleep(2);
}

// Spike test scenario - batch requests
export function spikeTest() {
  const responses = http.batch([
    ['GET', `${BASE_URL}/health/live`],
    ['GET', `${BASE_URL}/api/v1/council-stats`],
    ['GET', `${BASE_URL}/api/v1/billing/plans`],
    ['GET', `${BASE_URL}/health`],
  ]);

  responses.forEach((res) => {
    check(res, {
      'batch request succeeded': (r) => r.status === 200,
    });
  });

  sleep(0.5);
}
