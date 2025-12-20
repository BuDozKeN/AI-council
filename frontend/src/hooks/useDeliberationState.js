import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MODEL_STATES } from '../components/deliberation/types';
import { extractGaps, cleanGapMarkers, analyzeResponses, isSimilarToSeenGaps } from '../utils/gapDetection';
import { getModelPersona } from '../config/modelPersonas';

/**
 * useDeliberationState - Custom hook for managing deliberation view state
 *
 * Tracks model states, streaming content, and insights during council deliberation.
 * Integrates with existing ChatInterface loading states.
 */
export function useDeliberationState({
  stage1Streaming = {},
  stage2Streaming = {},
  stage3Streaming = null,
  loading = {},
  userQuestion = '',
  contextKeywords = []
}) {
  // Track model states
  const [modelStates, setModelStates] = useState({});

  // Track insights
  const [insights, setInsights] = useState([]);

  // Track seen gaps to avoid duplicates (using ref to avoid stale closure issues)
  const seenGapsRef = useRef(new Set());

  // Track stage transitions
  const [showTransition, setShowTransition] = useState(false);
  const [previousStage, setPreviousStage] = useState(null);

  // Track previous loading state to detect new deliberation start
  const wasLoadingRef = useRef(false);

  // Determine current stage
  const currentStage = useMemo(() => {
    if (loading.stage3) return 'synthesising';
    if (loading.stage2) return 'reviewing';
    if (loading.stage1) return 'drafting';
    return null;
  }, [loading]);

  // Auto-reset when a new deliberation starts (loading goes from idle to stage1)
  useEffect(() => {
    const isLoading = loading.stage1 || loading.stage2 || loading.stage3;
    const wasLoading = wasLoadingRef.current;

    // Detect new deliberation start: was idle, now loading stage1
    if (!wasLoading && loading.stage1) {
      setModelStates({});
      setInsights([]);
      seenGapsRef.current = new Set();
      setShowTransition(false);
      setPreviousStage(null);
    }

    wasLoadingRef.current = isLoading;
  }, [loading.stage1, loading.stage2, loading.stage3]);

  // Detect stage transitions
  useEffect(() => {
    if (previousStage && currentStage && previousStage !== currentStage) {
      setShowTransition(true);
      const timer = setTimeout(() => setShowTransition(false), 1500);
      return () => clearTimeout(timer);
    }
    setPreviousStage(currentStage);
  }, [currentStage, previousStage]);

  // Get active model (currently streaming)
  const activeModel = useMemo(() => {
    if (loading.stage1) {
      // Find model that's currently streaming
      for (const [modelId, data] of Object.entries(stage1Streaming)) {
        if (data && !data.complete && !data.error) {
          return modelId;
        }
      }
    }
    if (loading.stage2) {
      for (const [modelId, data] of Object.entries(stage2Streaming)) {
        if (data && !data.complete && !data.error) {
          return modelId;
        }
      }
    }
    if (loading.stage3) {
      return 'chairman';
    }
    return null;
  }, [loading, stage1Streaming, stage2Streaming]);

  // Get streaming content from active model
  const streamingContent = useMemo(() => {
    if (loading.stage1 && activeModel) {
      const data = stage1Streaming[activeModel];
      return data?.text || data?.response || '';
    }
    if (loading.stage2 && activeModel) {
      const data = stage2Streaming[activeModel];
      return data?.text || data?.reasoning || '';
    }
    if (loading.stage3 && stage3Streaming) {
      return stage3Streaming.text || stage3Streaming.response || '';
    }
    return '';
  }, [loading, activeModel, stage1Streaming, stage2Streaming, stage3Streaming]);

  // Update model states based on streaming data
  // Use ref to track last computed states and avoid unnecessary re-renders
  const lastModelStatesRef = useRef({});

  useEffect(() => {
    const newStates = {};

    // Stage 1: Map streaming models to states
    if (loading.stage1 || Object.keys(stage1Streaming).length > 0) {
      for (const [modelId, data] of Object.entries(stage1Streaming)) {
        if (!data) {
          newStates[modelId] = MODEL_STATES.WAITING;
        } else if (data.error) {
          newStates[modelId] = MODEL_STATES.ERROR;
        } else if (data.complete) {
          newStates[modelId] = MODEL_STATES.COMPLETE;
        } else {
          newStates[modelId] = MODEL_STATES.THINKING;
        }
      }
    }

    // Stage 2: Models are reviewing
    if (loading.stage2 || Object.keys(stage2Streaming).length > 0) {
      // All previous models switch to reviewing state
      for (const modelId of Object.keys(stage1Streaming)) {
        if (!stage2Streaming[modelId]) {
          newStates[modelId] = MODEL_STATES.COMPLETE;
        }
      }
      // Update reviewing models
      for (const [modelId, data] of Object.entries(stage2Streaming)) {
        if (!data) {
          newStates[modelId] = MODEL_STATES.WAITING;
        } else if (data.error) {
          newStates[modelId] = MODEL_STATES.ERROR;
        } else if (data.complete) {
          newStates[modelId] = MODEL_STATES.COMPLETE;
        } else {
          newStates[modelId] = MODEL_STATES.REVIEWING;
        }
      }
    }

    // Stage 3: All models complete
    if (loading.stage3) {
      for (const modelId of Object.keys(newStates)) {
        if (newStates[modelId] !== MODEL_STATES.ERROR) {
          newStates[modelId] = MODEL_STATES.COMPLETE;
        }
      }
    }

    // Only update state if the computed states actually changed
    const lastStates = lastModelStatesRef.current;
    const statesChanged = Object.keys(newStates).length !== Object.keys(lastStates).length ||
      Object.entries(newStates).some(([key, value]) => lastStates[key] !== value);

    if (statesChanged) {
      lastModelStatesRef.current = newStates;
      setModelStates(newStates);
    }
  }, [loading.stage1, loading.stage2, loading.stage3, stage1Streaming, stage2Streaming]);

  // Extract gaps from streaming content
  useEffect(() => {
    if (!streamingContent || !activeModel) return;

    const gaps = extractGaps(streamingContent, activeModel);

    // Filter out already-seen gaps using semantic similarity
    const newGaps = gaps.filter(gap => {
      // Check if similar gap already exists
      if (isSimilarToSeenGaps(gap, seenGapsRef.current)) return false;
      // Add this gap's content to the seen set
      seenGapsRef.current.add(gap.content);
      return true;
    });

    if (newGaps.length > 0) {
      setInsights(prev => [...prev, ...newGaps]);
    }
  }, [streamingContent, activeModel]);

  // Analyze responses when stage 1 completes
  useEffect(() => {
    if (!loading.stage1 && Object.keys(stage1Streaming).length > 0) {
      const responses = Object.entries(stage1Streaming)
        .filter(([, data]) => data?.complete && data?.text)
        .map(([modelId, data]) => ({
          modelId,
          text: data.text
        }));

      if (responses.length >= 2) {
        const patternInsights = analyzeResponses(responses);
        if (patternInsights.length > 0) {
          setInsights(prev => [...prev, ...patternInsights]);
        }
      }
    }
  }, [loading.stage1, stage1Streaming]);

  // Count completed/total models
  const completedModels = useMemo(() => {
    return Object.values(modelStates).filter(
      state => state === MODEL_STATES.COMPLETE || state === MODEL_STATES.ERROR
    ).length;
  }, [modelStates]);

  const totalModels = useMemo(() => {
    return Object.keys(modelStates).length;
  }, [modelStates]);

  // Model IDs for display
  const modelIds = useMemo(() => {
    return Object.keys(modelStates);
  }, [modelStates]);

  // Add context handler
  const handleAddContext = useCallback(async (suggestedField, gapContent) => {
    // This should be connected to your context management system
    console.log('Add context:', { suggestedField, gapContent });
    // Return a promise for the UI to await
    return new Promise(resolve => setTimeout(resolve, 500));
  }, []);

  // Reset state for new conversation (also called automatically on new deliberation start)
  const resetState = useCallback(() => {
    setModelStates({});
    setInsights([]);
    seenGapsRef.current = new Set();
    setShowTransition(false);
    setPreviousStage(null);
  }, []);

  // Check if deliberation view should be shown
  const shouldShowDeliberationView = useMemo(() => {
    return loading.stage1 || loading.stage2 || loading.stage3;
  }, [loading]);

  return {
    // State
    currentStage,
    modelStates,
    modelIds,
    activeModel,
    streamingContent: cleanGapMarkers(streamingContent),
    insights,
    completedModels,
    totalModels,
    shouldShowDeliberationView,

    // Transitions
    showTransition,
    previousStage,

    // Question
    question: userQuestion,

    // Actions
    onAddContext: handleAddContext,
    resetState
  };
}

export default useDeliberationState;
