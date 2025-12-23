import { useState, useCallback } from 'react';
import { Play, RotateCcw, FlaskConical, Loader2 } from 'lucide-react';
import { DeliberationView } from './DeliberationView';
import { MODEL_STATES, INSIGHT_TYPES } from './types';
import { logger } from '../../utils/logger';

/**
 * DeliberationDemo - Interactive demo of the Council in Session view
 *
 * Use this to test the deliberation view with mock data.
 * Access via: /demo/deliberation (add route) or import directly
 */

// Sample streaming text that includes gap markers
const SAMPLE_RESPONSES = {
  'gpt-4': `Expanding to the European market requires careful consideration of several factors.

First, GDPR compliance is non-negotiable. You'll need to ensure data processing agreements are in place and your privacy policy covers EU residents.

[GAP: current customer base in EU to assess market fit]

For payment processing, consider local payment methods like SEPA, iDEAL (Netherlands), and Bancontact (Belgium) alongside cards.

[GAP: company location for tax implications - VAT registration may be required]

I'd recommend starting with UK, Germany, and France as they represent the largest e-commerce markets.`,

  'claude-3-opus': `European expansion is an exciting opportunity, but timing matters.

Key considerations:
1. Regulatory landscape - GDPR, Digital Services Act, upcoming AI Act
2. Localization - not just translation, but cultural adaptation
3. Support hours - you'll need coverage for EU time zones

[GAP: team size to assess if you can support multiple time zones]

The competitive landscape varies significantly by country. Germany has strong local players, while UK is more open to US entrants.

I'd suggest a phased approach: soft launch in one market, learn, then expand.`,

  'gemini-pro': `Based on market analysis, Q1 expansion to Europe could work, but Q2 might be safer.

Here's my reasoning:
- Q1 is post-holiday, businesses are budget planning
- Q2 gives you time to prepare for GDPR compliance fully
- Summer (Q3) sees lower B2B activity in Europe

[GAP: current revenue to gauge investment capacity for localization]

The €50-100K typical investment for proper EU market entry includes legal setup, localization, and initial marketing.

Start with English-speaking markets (UK, Ireland, Netherlands) to minimize localization costs.`,

  'grok-2': `Alright, let's cut through the noise on EU expansion.

Real talk: Europe isn't one market, it's 27+ different markets with different languages, cultures, and regulations. That said, there's a massive opportunity if you play it right.

[GAP: current product-market fit data to assess EU readiness]

My hot take: Skip the traditional markets initially. Consider the Nordics (Sweden, Denmark) - high English proficiency, tech-savvy populations, and they're often early adopters.

The Brexit aftermath means UK is now separate from EU regulatory framework - that's both an opportunity and a complication.`,

  'deepseek-chat': `Let me analyze this from multiple angles.

Market Analysis:
- EU GDP: ~$16 trillion, significant opportunity
- E-commerce growth: 12% YoY in major EU markets
- Digital Services Act compliance deadline approaching

Technical Considerations:
- Data residency requirements in certain countries
- Cookie consent mechanisms (stricter than US)
- Right to erasure implementation

[GAP: current tech stack to assess GDPR compliance readiness]

I recommend a thorough technical audit before expansion. The cost of non-compliance (up to 4% of global revenue) far exceeds the investment in proper infrastructure.`
};

// Mock departments for demo
const MOCK_DEPARTMENTS = [
  { id: 'eng', name: 'Engineering' },
  { id: 'sales', name: 'Sales' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'ops', name: 'Operations' }
];

// Mock insights that would be detected
// Include both text-answer questions and yes/no questions
const MOCK_INSIGHTS = [
  {
    type: INSIGHT_TYPES.KNOWLEDGE_GAP,
    source: 'GPT-4',
    content: 'Do you currently have any customers in Europe?',
    suggestedContext: 'Customer and user information',
    isYesNo: true, // Binary question
    timestamp: Date.now()
  },
  {
    type: INSIGHT_TYPES.KNOWLEDGE_GAP,
    source: 'GPT-4',
    content: 'Where is your company headquartered?',
    suggestedContext: 'Company location and target markets',
    isYesNo: false,
    timestamp: Date.now() + 1000
  },
  {
    type: INSIGHT_TYPES.KNOWLEDGE_GAP,
    source: 'Claude',
    content: 'How many people are on your team?',
    suggestedContext: 'Team size and structure',
    isYesNo: false,
    timestamp: Date.now() + 3000
  },
  {
    type: INSIGHT_TYPES.KNOWLEDGE_GAP,
    source: 'Grok',
    content: 'Have you validated product-market fit in your current market?',
    suggestedContext: 'Product metrics and KPIs',
    isYesNo: true, // Binary question
    timestamp: Date.now() + 6000
  },
  {
    type: INSIGHT_TYPES.KNOWLEDGE_GAP,
    source: 'DeepSeek',
    content: 'Is your tech stack already GDPR compliant?',
    suggestedContext: 'Technology and infrastructure',
    isYesNo: true, // Binary question
    timestamp: Date.now() + 9000
  },
  {
    type: INSIGHT_TYPES.CONSENSUS,
    content: '5 of 5 models emphasize: "GDPR compliance is critical"',
    timestamp: Date.now() + 12000
  }
];

export function DeliberationDemo() {
  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState('drafting');
  const [modelStates, setModelStates] = useState({});
  const [streamingContent, setStreamingContent] = useState('');
  const [activeModel, setActiveModel] = useState(null);
  const [insights, setInsights] = useState([]);
  const [completedModels, setCompletedModels] = useState(0);
  const [showTransition, setShowTransition] = useState(false);
  const [previousStage, setPreviousStage] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- modelIds is intentionally recreated per render for demo
  const modelIds = ['gpt-4', 'claude-3-opus', 'gemini-pro', 'grok-2', 'deepseek-chat'];
  const totalModels = modelIds.length;

  // Reset simulation
  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    setCurrentStage('drafting');
    setModelStates({});
    setStreamingContent('');
    setActiveModel(null);
    setInsights([]);
    setCompletedModels(0);
    setShowTransition(false);
    setPreviousStage(null);
  }, []);

  // Simulate streaming text character by character
  const simulateStreaming = useCallback(async (modelId, text, onComplete) => {
    setActiveModel(modelId);
    setModelStates(prev => ({ ...prev, [modelId]: MODEL_STATES.THINKING }));

    let currentText = '';
    const words = text.split(' ');

    for (let i = 0; i < words.length; i++) {
      if (!isRunning) break;

      currentText += (i > 0 ? ' ' : '') + words[i];
      setStreamingContent(currentText);

      // Random delay between words (50-150ms)
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
    }

    setModelStates(prev => ({ ...prev, [modelId]: MODEL_STATES.COMPLETE }));
    setCompletedModels(prev => prev + 1);
    onComplete?.();
  }, [isRunning]);

  // Run the full simulation
  const runSimulation = useCallback(async () => {
    setIsRunning(true);
    resetSimulation();
    setIsRunning(true);

    // Initialize all models as waiting
    const initialStates = {};
    modelIds.forEach(id => { initialStates[id] = MODEL_STATES.WAITING; });
    setModelStates(initialStates);

    // Stage 1: Individual responses
    setCurrentStage('drafting');

    // Simulate each model responding (in sequence for demo clarity)
    for (let i = 0; i < modelIds.length; i++) {
      const modelId = modelIds[i];
      const response = SAMPLE_RESPONSES[modelId] || 'Thinking about this question...';

      await new Promise(resolve => {
        simulateStreaming(modelId, response, resolve);
      });

      // Add insights progressively based on model index
      // GPT-4 insights (index 0)
      if (i === 0 && MOCK_INSIGHTS[0]) {
        setInsights(prev => [...prev, MOCK_INSIGHTS[0]]);
      }
      if (i === 0 && MOCK_INSIGHTS[1]) {
        setTimeout(() => setInsights(prev => [...prev, MOCK_INSIGHTS[1]]), 500);
      }
      // Claude insight (index 1)
      if (i === 1 && MOCK_INSIGHTS[2]) {
        setInsights(prev => [...prev, MOCK_INSIGHTS[2]]);
      }
      // Grok insight (index 3)
      if (i === 3 && MOCK_INSIGHTS[3]) {
        setInsights(prev => [...prev, MOCK_INSIGHTS[3]]);
      }
      // DeepSeek insight (index 4)
      if (i === 4 && MOCK_INSIGHTS[4]) {
        setInsights(prev => [...prev, MOCK_INSIGHTS[4]]);
      }

      await new Promise(r => setTimeout(r, 500)); // Brief pause between models
    }

    // Transition to Stage 2
    setPreviousStage('drafting');
    setShowTransition(true);
    await new Promise(r => setTimeout(r, 2000));
    setShowTransition(false);
    setCurrentStage('reviewing');

    // Stage 2: Peer review (simulate reviewing states)
    setStreamingContent('');
    for (const modelId of modelIds) {
      setModelStates(prev => ({ ...prev, [modelId]: MODEL_STATES.REVIEWING }));
      await new Promise(r => setTimeout(r, 600));
      setModelStates(prev => ({ ...prev, [modelId]: MODEL_STATES.COMPLETE }));
    }

    // Add consensus insight after peer review
    if (MOCK_INSIGHTS[5]) {
      setInsights(prev => [...prev, MOCK_INSIGHTS[5]]);
    }

    await new Promise(r => setTimeout(r, 1000));

    // Transition to Stage 3
    setPreviousStage('reviewing');
    setShowTransition(true);
    await new Promise(r => setTimeout(r, 2000));
    setShowTransition(false);
    setCurrentStage('synthesising');

    // Stage 3: Chairman synthesis
    setActiveModel('chairman');
    const chairmanResponse = `Based on the council's analysis, I recommend a Q2 2024 expansion to Europe, starting with the UK market.

Key points of consensus:
- GDPR compliance is critical and non-negotiable
- Phased approach recommended over simultaneous multi-country launch
- Local payment methods essential for conversion

[GAP: budget allocation for EU expansion to refine timeline]

Action items:
1. Engage EU legal counsel for GDPR compliance audit
2. Research UK-specific payment processors
3. Plan localization for UK English (not just US English)

The council notes several gaps in context that would improve this recommendation - see the insights panel for details.`;

    await simulateStreaming('chairman', chairmanResponse, () => {
      setIsRunning(false);
    });

  }, [modelIds, simulateStreaming, resetSimulation]);

  // Handle stop
  const handleStop = () => {
    setIsRunning(false);
  };

  // Handle add context (mock) - receives data from AddContextModal
  const handleAddContext = async (data) => {
    logger.debug('Context saved:', data);
    // In real app, this would call API to save to company/department context
    // For demo, just log it
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Demo controls */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        background: '#f0f9ff',
        borderRadius: '12px',
        border: '1px solid #bae6fd'
      }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FlaskConical size={20} />
          Deliberation View Demo
        </h2>
        <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '14px' }}>
          This simulates the "Council in Session" experience with mock data.
          Watch the avatars change state, text stream in, and insights appear.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={runSimulation}
            disabled={isRunning}
            style={{
              padding: '10px 20px',
              background: isRunning ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {isRunning ? 'Running...' : 'Start Simulation'}
          </button>
          <button
            onClick={resetSimulation}
            style={{
              padding: '10px 20px',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* The actual deliberation view */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        <DeliberationView
          question="Should we expand to the European market next quarter?"
          currentStage={currentStage}
          modelStates={modelStates}
          streamingContent={streamingContent}
          activeModel={activeModel}
          insights={insights}
          completedModels={completedModels}
          totalModels={totalModels}
          onAddContext={handleAddContext}
          onStop={isRunning ? handleStop : undefined}
          showTransition={showTransition}
          previousStage={previousStage}
          companyName="Demo Company"
          departments={MOCK_DEPARTMENTS}
        />
      </div>

      {/* Debug info */}
      <details style={{ marginTop: '24px' }}>
        <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: '13px' }}>
          🔧 Debug State
        </summary>
        <pre style={{
          marginTop: '8px',
          padding: '12px',
          background: '#1e293b',
          color: '#94a3b8',
          borderRadius: '8px',
          fontSize: '11px',
          overflow: 'auto'
        }}>
{JSON.stringify({
  isRunning,
  currentStage,
  activeModel,
  completedModels,
  totalModels,
  modelStates,
  insightsCount: insights.length
}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default DeliberationDemo;
