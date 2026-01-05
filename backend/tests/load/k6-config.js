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
  // Stages for ramping up/down load
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],

  // Performance thresholds
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
    errors: ['rate<0.01'],             // Custom error rate < 1%
  },
};

// Test scenarios
export default function () {
  // Health check endpoint
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check latency < 100ms': (r) => r.timings.duration < 100,
  });
  apiLatency.add(healthRes.timings.duration);
  errorRate.add(healthRes.status !== 200);

  sleep(1);

  // API info endpoint
  const infoRes = http.get(`${BASE_URL}/api/v1/info`);
  check(infoRes, {
    'info status is 200': (r) => r.status === 200,
  });
  apiLatency.add(infoRes.timings.duration);
  errorRate.add(infoRes.status !== 200);

  sleep(1);

  // Circuit breaker status
  const circuitRes = http.get(`${BASE_URL}/api/v1/circuit-breakers`);
  check(circuitRes, {
    'circuit breaker status is 200': (r) => r.status === 200,
  });
  apiLatency.add(circuitRes.timings.duration);

  sleep(1);
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

// Spike test scenario
export function spikeTest() {
  const responses = http.batch([
    ['GET', `${BASE_URL}/health`],
    ['GET', `${BASE_URL}/api/v1/info`],
  ]);

  responses.forEach((res) => {
    check(res, {
      'batch request succeeded': (r) => r.status === 200,
    });
  });

  sleep(0.5);
}
