# React Best Practices Review - January 2026

**Overall Grade: B+ (Very Good with room for optimization)**

## Executive Summary

The codebase demonstrates strong engineering practices with excellent state management, performance optimizations, and comprehensive error handling. This review identifies prioritized improvements focusing on quick wins and high-impact fixes.

---

## Quick Wins (Can Implement Today)

### 1. Enable TypeScript Strict Mode Features
**Impact:** High | **Effort:** Low | **Files:** `tsconfig.json`

Current missing compiler flags:
```json
{
  "compilerOptions": {
    "noImplicitReturns": true,      // Catch missing return statements
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Why:** Catches bugs at compile time instead of runtime.

### 2. Add Bundle Analysis Script
**Impact:** Medium | **Effort:** Low | **Files:** `package.json`

```bash
npm install --save-dev vite-bundle-visualizer
```

```json
{
  "scripts": {
    "analyze": "vite-bundle-visualizer"
  }
}
```

**Why:** Identify bundle bloat and optimization opportunities visually.

### 3. Fix Type Assertion in App.tsx
**Impact:** Low | **Effort:** Low | **Files:** `frontend/src/App.tsx:1751`

```tsx
// BEFORE (defeats type checking)
initialContext={projectModalContext as any}

// AFTER (type-safe)
initialContext={projectModalContext as ProjectModalContext | undefined}
```

### 4. Add aria-live for Streaming Responses
**Impact:** High (A11y) | **Effort:** Low | **Files:** `ChatInterface.tsx`

```tsx
// Add to streaming message containers
<div
  role="status"
  aria-live="polite"
  aria-atomic="false"
>
  {stage3Streaming?.text}
</div>
```

**Why:** Makes streaming responses accessible to screen readers.

### 5. Add Focus Management to Modals
**Impact:** High (A11y) | **Effort:** Low | **Files:** `Settings.tsx`, `AppModal.tsx`

```tsx
const Settings = ({ isOpen, onClose }: Props) => {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClose = () => {
    onClose();
    // Return focus to trigger after modal closes
    setTimeout(() => triggerRef.current?.focus(), 100);
  };

  // Store ref to trigger element
};
```

---

## High Priority Fixes (This Sprint)

### 6. Extract Message Streaming Logic from App.tsx
**Impact:** High | **Effort:** Medium | **Files:** `App.tsx` (1866 lines)

**Problem:** God component violating Single Responsibility Principle.

**Solution:** Extract into custom hooks:

```tsx
// hooks/useMessageStreaming.ts
export const useMessageStreaming = () => {
  // Lines 727-1236 from App.tsx
  return { handleSendToCouncil, cancelStream, ... };
};

// hooks/useChatMessages.ts
export const useChatMessages = () => {
  // Lines 1238-1387 from App.tsx
  return { addMessage, updateMessage, deleteMessage };
};

// hooks/useConversationActions.ts
export const useConversationActions = () => {
  // Bulk operations, deletion logic
  return { deleteConversations, archiveAll, ... };
};
```

**Benefits:**
- Easier to test individual features
- Reduces merge conflicts
- Improves code readability

### 7. Refactor ChatInterface Props (117 Props)
**Impact:** High | **Effort:** Medium | **Files:** `ChatInterface.tsx:43-117`

**Problem:** Prop drilling makes component tightly coupled.

**Solution:** Use composition pattern:

```tsx
// BEFORE (117 props passed down)
<ChatInterface
  currentConversationId={...}
  messages={...}
  onSendMessage={...}
  // ... 114 more props
/>

// AFTER (composition with context)
<ConversationProvider conversationId={currentConversationId}>
  <ChatHeader />
  <MessageList />
  <ChatInput />
  <LLMHub />
</ConversationProvider>
```

**Benefits:**
- Components only subscribe to data they need
- Reduces re-renders
- Easier to maintain

### 8. Add Feature-Level Error Boundaries
**Impact:** High | **Effort:** Low | **Files:** `App.tsx`, new `ErrorBoundary` wrappers

**Problem:** Single global error boundary means any crash takes down the entire app.

**Solution:**

```tsx
// In App.tsx
<ErrorBoundary fallback={<ChatErrorFallback />}>
  <ChatInterface />
</ErrorBoundary>

<ErrorBoundary fallback={<MyCompanyErrorFallback />}>
  <MyCompany />
</ErrorBoundary>
```

Create specific fallback components:
```tsx
// components/errors/ChatErrorFallback.tsx
export const ChatErrorFallback = ({ error, resetError }: Props) => (
  <div className="chat-error-container">
    <h2>Chat temporarily unavailable</h2>
    <button onClick={resetError}>Reload Chat</button>
  </div>
);
```

### 9. Fix Stale Closure Bug Pattern
**Impact:** High | **Effort:** Medium | **Files:** `useCompanyData.ts:78-90`, others

**Problem:** Using refs to avoid stale closures indicates incorrect dependency arrays.

**Current workaround:**
```tsx
const loadedRef = useRef({ overview: false, team: false });
const loadingInProgressRef = useRef<string | null>(null);

const loadData = useCallback(async () => {
  if (loadedRef.current[tab]) return; // Reading from ref instead of state
  // ...
}, [tab]); // Missing dependencies
```

**Better solution:**
```tsx
// Option 1: Correct dependencies (may trigger more)
const loadData = useCallback(async (tab: string) => {
  if (loaded[tab]) return;
  // ...
}, [loaded]); // Include all dependencies

// Option 2: Use reducer for complex state
const [state, dispatch] = useReducer(companyDataReducer, initialState);

// Option 3: Event emitter pattern (for truly independent triggers)
```

**Action:** Audit all `useCallback` hooks that use refs. Fix dependency arrays.

### 10. Implement API Retry Logic
**Impact:** Medium | **Effort:** Low | **Files:** `main.tsx:133`

**Problem:** Single retry means network blips cause immediate failure.

**Current:**
```tsx
retry: 1
```

**Better:**
```tsx
retry: (failureCount, error) => {
  // Don't retry client errors (4xx)
  if (error.status >= 400 && error.status < 500) return false;

  // Retry network errors and 5xx up to 3 times
  return failureCount < 3;
},
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
```

---

## Medium Priority (Next Sprint)

### 11. Reduce Over-Memoization
**Impact:** Medium | **Effort:** Medium | **Files:** Multiple

**Problem:** Memoizing simple operations can hurt more than help.

**Action:**
1. Profile with React DevTools Profiler
2. Remove `useMemo` for operations <5ms
3. Focus memoization on:
   - Expensive computations (parsing, filtering large arrays)
   - Object/array literals passed as props to memoized children
   - Callback functions passed to heavy child components

**Example to remove:**
```tsx
// BEFORE (useMemo overhead > computation cost)
const departmentPreset = useMemo<LLMPresetId>(() => {
  if (selectedDepartments.length > 0) {
    const dept = availableDepartments.find(...);
    if (dept?.llm_preset) return dept.llm_preset;
  }
  return 'balanced';
}, [selectedDepartments, availableDepartments]);

// AFTER (just compute inline)
const departmentPreset: LLMPresetId =
  selectedDepartments.length > 0
    ? availableDepartments.find(...)?.llm_preset ?? 'balanced'
    : 'balanced';
```

### 12. Add React.memo to List Item Components
**Impact:** Medium | **Effort:** Low | **Files:** `ConversationItem.tsx`, `DepartmentCard.tsx`, etc.

```tsx
// BEFORE
export const ConversationItem = ({ conversation, onClick }: Props) => {
  // ...
};

// AFTER
export const ConversationItem = React.memo(({ conversation, onClick }: Props) => {
  // ...
}, (prevProps, nextProps) => {
  // Custom comparison for optimization
  return prevProps.conversation.id === nextProps.conversation.id &&
         prevProps.conversation.updated_at === nextProps.conversation.updated_at;
});
```

### 13. Split Large Context Files
**Impact:** Medium | **Effort:** High | **Files:** `BusinessContext.tsx` (500 lines), `ConversationContext.tsx` (680 lines)

**Solution:**
```tsx
// contexts/business/BusinessContext.tsx (orchestrator)
// contexts/business/useCompanies.ts (companies logic)
// contexts/business/useDepartments.ts (departments logic)
// contexts/business/useRoles.ts (roles logic)

// Import and compose in BusinessContext
export const BusinessProvider = ({ children }) => {
  const companies = useCompanies();
  const departments = useDepartments();
  const roles = useRoles();

  return (
    <BusinessContext.Provider value={{ companies, departments, roles }}>
      {children}
    </BusinessContext.Provider>
  );
};
```

### 14. Remove requestAnimationFrame Anti-pattern
**Impact:** Low | **Effort:** Low | **Files:** `BusinessContext.tsx:339`, others

```tsx
// BEFORE (over-engineered)
const frameId = requestAnimationFrame(() => {
  setSelectedProject(null);
});
return () => cancelAnimationFrame(frameId);

// AFTER (simple)
setSelectedProject(null);
```

**Why:** React 18 automatic batching makes this unnecessary. Use `requestAnimationFrame` only for actual animations.

### 15. Add Missing useEffect Cleanups
**Impact:** Medium | **Effort:** Low | **Files:** Multiple

**Action:** Search for `useEffect` with timers, event listeners, or subscriptions and ensure cleanup:

```tsx
// GOOD (has cleanup)
useEffect(() => {
  const timeout = setTimeout(() => {...}, 1000);
  return () => clearTimeout(timeout);
}, []);

// BAD (missing cleanup)
useEffect(() => {
  setTimeout(() => {...}, 1000); // Leaks if component unmounts
}, []);
```

---

## Code Quality Metrics

| Category | Score | Target |
|----------|-------|--------|
| Component Organization | B+ | A |
| State Management | A- | A |
| TypeScript Safety | B+ | A |
| Performance | B | A- |
| Accessibility | B- | A |
| Error Handling | A- | A |
| Testing | C | B+ |
| Bundle Optimization | A- | A |

---

## Testing Gaps (Future Work)

**Problem:** Only 5 test files found in frontend/src.

**Recommendation:**
1. Add tests for custom hooks (`useMessageStreaming`, `useConversationActions`)
2. Add component tests for critical UI (ChatInterface, MyCompany)
3. Add integration tests for context providers
4. Target: 70% coverage (matching backend)

---

## Accessibility Compliance Checklist

- [x] Skip to main content link
- [x] Keyboard navigation (useKeyboardShortcuts)
- [x] Loading states with aria-label
- [ ] Focus management after modal close
- [ ] Live regions for dynamic content (streaming)
- [ ] Loading announcements to screen readers
- [ ] Focus visible states on all interactive elements
- [ ] Color contrast ratio compliance (WCAG AA)

---

## Performance Budget Recommendations

Current bundle analysis needed to establish baselines.

**Proposed budgets:**
- Initial JS bundle: <150KB gzipped
- CSS bundle: <100KB gzipped (already met: 104KB)
- Time to Interactive: <3s on 3G
- First Contentful Paint: <1.5s

**Action:** Run `npm run analyze` after implementing script in Quick Win #2.

---

## Implementation Roadmap

### Week 1: Quick Wins
- [ ] Enable TypeScript strict features
- [ ] Add bundle analysis
- [ ] Fix type assertions
- [ ] Add aria-live regions
- [ ] Add focus management

**Estimated effort:** 4-6 hours

### Week 2-3: High Priority Fixes
- [ ] Extract message streaming hooks
- [ ] Refactor ChatInterface props
- [ ] Add feature error boundaries
- [ ] Fix stale closure bugs
- [ ] Implement retry logic

**Estimated effort:** 2-3 days

### Week 4-5: Medium Priority
- [ ] Profile and reduce over-memoization
- [ ] Add React.memo to list items
- [ ] Split large context files
- [ ] Remove requestAnimationFrame anti-patterns
- [ ] Add missing useEffect cleanups

**Estimated effort:** 3-4 days

---

## Conclusion

The codebase shows signs of experienced React developers who understand modern best practices. The use of TanStack Query, split contexts, and code splitting is exemplary.

**Top 3 Focus Areas:**
1. **Component size reduction** - Break up App.tsx and ChatInterface.tsx
2. **Accessibility** - Add focus management and live regions
3. **Type safety** - Enable strict TypeScript and add return types

By addressing these prioritized improvements, the codebase can move from B+ to A grade while maintaining its current strengths.

---

**Review completed:** 2026-01-16
**Next review recommended:** After implementing High Priority fixes
