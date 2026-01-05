# Load Testing with k6

This directory contains load testing configuration for AxCouncil API.

## Prerequisites

Install k6:
- **macOS**: `brew install k6`
- **Windows**: `choco install k6` or download from https://k6.io/docs/getting-started/installation/
- **Linux**: See https://k6.io/docs/getting-started/installation/

## Running Load Tests

### Basic Load Test (Unauthenticated)

```bash
# Start your backend server first
python -m backend.main

# Run load test
k6 run backend/tests/load/k6-config.js
```

### With Authentication

```bash
# Set your API token
export API_TOKEN="your-jwt-token-here"

# Run with custom base URL
k6 run -e BASE_URL=http://localhost:8081 -e API_TOKEN=$API_TOKEN backend/tests/load/k6-config.js
```

### Against Production

```bash
k6 run -e BASE_URL=https://axcouncil-backend.onrender.com backend/tests/load/k6-config.js
```

## Test Scenarios

### Default Scenario
- Ramps up to 10 users over 30s
- Holds 10 users for 1 minute
- Ramps up to 50 users over 30s
- Holds 50 users for 2 minutes
- Ramps down over 30s

### Thresholds
- 95th percentile latency < 500ms
- Error rate < 1%

## Custom Scenarios

### Spike Test
```bash
k6 run --vus 100 --duration 30s backend/tests/load/k6-config.js
```

### Stress Test
```bash
k6 run --vus 200 --duration 5m backend/tests/load/k6-config.js
```

## Output

Results include:
- Request duration (p50, p95, p99)
- Error rate
- Requests per second
- Custom `api_latency` metric

## CI Integration

Add to GitHub Actions:
```yaml
- name: Run Load Tests
  run: |
    k6 run --out json=results.json backend/tests/load/k6-config.js
```
