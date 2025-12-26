# ADR-004: AI Streaming Architecture

## Status
Accepted (Implemented with optimization opportunities)

## Context

AxCouncil's core feature is the AI Council - a system that streams responses from 5 AI models simultaneously, then synthesizes them. This requires a robust streaming architecture that handles:

- Multiple concurrent AI streams
- Real-time UI updates without jank
- Error handling and fallbacks
- Memory efficiency for long responses

### Requirements
1. Time to First Token (TTFT) < 500ms
2. Smooth 60fps UI updates during streaming
3. Graceful degradation if models fail
4. Memory stability for 30+ minute sessions

## Decision

Implement Server-Sent Events (SSE) with token batching and multi-stage orchestration.

### Protocol Choice: SSE over WebSocket

| Factor | SSE | WebSocket |
|--------|-----|-----------|
| Simplicity | Simpler | More complex |
| Browser support | Excellent | Excellent |
| Reconnection | Automatic | Manual |
| Bidirectional | No (not needed) | Yes |
| HTTP/2 compatible | Yes | Separate |

**Decision:** SSE is sufficient for our unidirectional streaming needs.

### Backend Architecture

```python
# council.py - Multi-stage streaming
async def stream_council(messages):
    # Stage 1: 5 models respond in parallel
    for i, model in enumerate(COUNCIL_MODELS):
        asyncio.create_task(
            stream_model(model, queue, delay=i * 0.8)  # Stagger starts
        )

    # Yield events as they arrive
    while not all_complete:
        event = await queue.get()
        yield f"data: {json.dumps(event)}\n\n"

    # Stage 2: Models rank each other
    # Stage 3: Chairman synthesizes
```

### Frontend Architecture

```typescript
// Token batching for 60fps
const flushTokens = useCallback(() => {
  const batch = tokenBuffer.current.join('');
  tokenBuffer.current = [];
  updateContent(batch);
  rafRef.current = null;
}, []);

const scheduleFlush = useCallback(() => {
  if (rafRef.current === null) {
    rafRef.current = requestAnimationFrame(flushTokens);
  }
}, [flushTokens]);
```

### Event Types

| Event | Purpose |
|-------|---------|
| `stage1_token` | Individual model token |
| `stage1_model_complete` | Model finished responding |
| `stage1_model_error` | Model failed |
| `stage1_all_complete` | All models done |
| `stage2_*` | Ranking stage events |
| `stage3_*` | Synthesis events |

## Implementation Details

### Model Staggering

Start models 800ms apart to:
- Avoid rate limiting
- Create visual "council discussing" effect
- Reduce backend load spikes

### Error Handling

```python
# Per-model error isolation
try:
    async for chunk in stream_model(model):
        yield chunk
except Exception as e:
    yield {"type": "stage1_model_error", "model": model}
    # Other models continue
```

### Chairman Fallback

```python
# Multiple chairman candidates
CHAIRMAN_MODELS = ['anthropic/claude-3-opus', 'openai/gpt-4', ...]

for chairman in CHAIRMAN_MODELS:
    try:
        async for chunk in synthesize(chairman, responses):
            yield chunk
        break  # Success
    except:
        continue  # Try next
```

## Consequences

### Positive
- Low TTFT (~400ms)
- Smooth UI updates (60fps batching)
- Resilient to individual model failures
- Good user experience during long responses

### Negative
- Complex orchestration logic
- Memory accumulation during long responses
- Queue can grow unbounded (identified for fix)

### Optimizations Identified

1. **Queue Backpressure** (ADR-004a)
   - Add `maxsize` to asyncio.Queue
   - Handle backpressure gracefully

2. **Buffer Optimization** (ADR-004b)
   - Use StringIO instead of string concatenation
   - Reduce O(n²) to O(n) memory

3. **Stream Timeout** (ADR-004c)
   - Add per-model timeout
   - Prevent infinite waits

## Metrics

### Success Criteria
- TTFT P95 < 500ms
- Zero dropped frames during streaming
- 99.5% stream completion rate
- Memory stable over 30-minute session

### Monitoring
- Track TTFT per model
- Track stream completion rate
- Monitor memory during streaming
- Alert on elevated error rates

## Related Documents
- [STREAMING_PERFORMANCE.md](../STREAMING_PERFORMANCE.md)
- [MEMORY_MANAGEMENT.md](../MEMORY_MANAGEMENT.md)

## References
- [MDN Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [requestAnimationFrame for Performance](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
