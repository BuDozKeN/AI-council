/**
 * Gap Detection Utility
 *
 * Detects [GAP: ...] markers in AI responses and converts them to insights.
 * Also provides consensus detection and context suggestions.
 */

const GAP_REGEX = /\[GAP:\s*([^\]]+)\]/gi;

/**
 * Normalize gap content for comparison (lowercase, remove punctuation, common words)
 */
function normalizeGapContent(content) {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\b(the|a|an|to|of|for|in|on|with|your|their|our|current|specific)\b/g, '') // Remove common words
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two gaps are semantically similar (>60% word overlap)
 */
function areSimilarGaps(gap1, gap2) {
  const norm1 = normalizeGapContent(gap1);
  const norm2 = normalizeGapContent(gap2);

  // Exact match after normalization
  if (norm1 === norm2) return true;

  // Check word overlap
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return false;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  // Jaccard similarity > 0.5 means similar
  return intersection / union > 0.5;
}

/**
 * Extract knowledge gaps from streaming text
 * @param {string} text - The streaming text from model
 * @param {string} modelId - The model ID that generated the text
 * @returns {Array<Object>} Array of gap insights
 */
export function extractGaps(text, modelId) {
  if (!text) return [];

  const matches = [...text.matchAll(GAP_REGEX)];

  return matches.map(match => ({
    type: 'knowledge_gap',
    source: modelId,
    content: match[1].trim(),
    suggestedContext: generateContextSuggestion(match[1]),
    normalizedContent: normalizeGapContent(match[1]), // For deduplication
    timestamp: Date.now()
  }));
}

/**
 * Check if a gap is similar to any in a set of seen gaps
 * @param {Object} gap - The gap to check
 * @param {Set} seenGaps - Set of normalized gap contents
 * @returns {boolean} True if similar gap already exists
 */
export function isSimilarToSeenGaps(gap, seenGaps) {
  for (const seenContent of seenGaps) {
    if (areSimilarGaps(gap.content, seenContent)) {
      return true;
    }
  }
  return false;
}

/**
 * Remove gap markers from display text
 * @param {string} text - Text containing gap markers
 * @returns {string} Cleaned text
 */
export function cleanGapMarkers(text) {
  if (!text) return '';
  return text.replace(GAP_REGEX, '').trim();
}

/**
 * Generate context suggestion based on gap description
 * @param {string} gapDescription - The gap content
 * @returns {string} Suggested context field
 */
function generateContextSuggestion(gapDescription) {
  const lower = gapDescription.toLowerCase();

  // Location/geography
  if (lower.includes('location') || lower.includes('based') || lower.includes('geography') || lower.includes('region') || lower.includes('country')) {
    return 'Company location and target markets';
  }

  // Revenue/financial
  if (lower.includes('revenue') || lower.includes('sales') || lower.includes('financial') || lower.includes('budget') || lower.includes('funding') || lower.includes('arr') || lower.includes('mrr')) {
    return 'Revenue and financial metrics';
  }

  // Team/employees
  if (lower.includes('team') || lower.includes('employee') || lower.includes('staff') || lower.includes('headcount') || lower.includes('hiring')) {
    return 'Team size and structure';
  }

  // Industry/market
  if (lower.includes('industry') || lower.includes('market') || lower.includes('sector') || lower.includes('vertical') || lower.includes('niche')) {
    return 'Industry and market context';
  }

  // Customer/user
  if (lower.includes('customer') || lower.includes('user') || lower.includes('client') || lower.includes('audience') || lower.includes('buyer')) {
    return 'Customer and user information';
  }

  // Product/service
  if (lower.includes('product') || lower.includes('service') || lower.includes('offering') || lower.includes('solution') || lower.includes('platform')) {
    return 'Product and service details';
  }

  // Technology/stack
  if (lower.includes('tech') || lower.includes('stack') || lower.includes('infrastructure') || lower.includes('architecture') || lower.includes('tools')) {
    return 'Technology stack information';
  }

  // Competition
  if (lower.includes('competitor') || lower.includes('competition') || lower.includes('alternative') || lower.includes('rival')) {
    return 'Competitive landscape';
  }

  // Goals/strategy
  if (lower.includes('goal') || lower.includes('objective') || lower.includes('strategy') || lower.includes('vision') || lower.includes('mission')) {
    return 'Business goals and strategy';
  }

  // Pricing
  if (lower.includes('pricing') || lower.includes('price') || lower.includes('cost') || lower.includes('subscription') || lower.includes('tier')) {
    return 'Pricing and business model';
  }

  // Timeline
  if (lower.includes('timeline') || lower.includes('deadline') || lower.includes('launch') || lower.includes('schedule')) {
    return 'Project timelines and milestones';
  }

  // Default
  return 'Additional business context';
}

/**
 * Detect consensus patterns in multiple model responses
 * @param {Array<Object>} responses - Array of {modelId, text} objects
 * @returns {Array<Object>} Consensus insights
 */
export function detectConsensus(responses) {
  if (!responses || responses.length < 2) return [];

  const insights = [];
  const keywords = extractKeywords(responses);

  // Find keywords that appear in majority of responses
  const threshold = Math.ceil(responses.length * 0.6); // 60% agreement
  const consensusKeywords = keywords.filter(kw => kw.count >= threshold);

  if (consensusKeywords.length > 0) {
    insights.push({
      type: 'consensus',
      content: `${consensusKeywords[0].count} of ${responses.length} models emphasize: "${consensusKeywords[0].keyword}"`,
      timestamp: Date.now()
    });
  }

  return insights;
}

/**
 * Detect tensions/disagreements between model responses
 * @param {Array<Object>} responses - Array of {modelId, text} objects
 * @returns {Array<Object>} Tension insights
 */
export function detectTensions(responses) {
  if (!responses || responses.length < 2) return [];

  const insights = [];

  // Look for contrasting phrases
  const contrastPhrases = [
    { positive: /\bshould\b/i, negative: /\bshould not\b|\bshouldn't\b/i },
    { positive: /\brecommend\b/i, negative: /\bdon't recommend\b|\badvise against\b/i },
    { positive: /\byes\b/i, negative: /\bno\b/i },
    { positive: /\bpros?\b/i, negative: /\bcons?\b/i }
  ];

  for (const phrase of contrastPhrases) {
    const positiveResponses = responses.filter(r => phrase.positive.test(r.text));
    const negativeResponses = responses.filter(r => phrase.negative.test(r.text));

    if (positiveResponses.length > 0 && negativeResponses.length > 0) {
      insights.push({
        type: 'tension',
        content: `Models have different perspectives on this topic`,
        source: `${positiveResponses.length} vs ${negativeResponses.length} models`,
        timestamp: Date.now()
      });
      break; // Only report first tension found
    }
  }

  return insights;
}

/**
 * Detect context references in model responses
 * @param {string} text - Model response text
 * @param {string} modelId - Model identifier
 * @param {Array<string>} contextKeywords - Keywords from user's context
 * @returns {Array<Object>} Context reference insights
 */
export function detectContextReferences(text, modelId, contextKeywords = []) {
  if (!text || !contextKeywords.length) return [];

  const insights = [];
  const foundKeywords = contextKeywords.filter(keyword =>
    text.toLowerCase().includes(keyword.toLowerCase())
  );

  if (foundKeywords.length > 0) {
    insights.push({
      type: 'context_reference',
      source: modelId,
      content: `Referenced your context: ${foundKeywords.slice(0, 3).join(', ')}${foundKeywords.length > 3 ? '...' : ''}`,
      timestamp: Date.now()
    });
  }

  return insights;
}

/**
 * Extract keywords from responses (simplified)
 * @param {Array<Object>} responses - Array of {modelId, text} objects
 * @returns {Array<Object>} Array of {keyword, count} sorted by count
 */
function extractKeywords(responses) {
  const keywordCounts = {};

  // Common stop words to ignore
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'they', 'their', 'them',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'also', 'now', 'here', 'there', 'then', 'once', 'about', 'into',
    'over', 'after', 'before', 'under', 'again', 'further', 'because',
    'while', 'during', 'through', 'between', 'against', 'above', 'below'
  ]);

  responses.forEach(({ text }) => {
    // Extract words 5+ characters, excluding stop words
    const words = (text.toLowerCase().match(/\b[a-z]{5,}\b/g) || [])
      .filter(word => !stopWords.has(word));

    words.forEach(word => {
      keywordCounts[word] = (keywordCounts[word] || 0) + 1;
    });
  });

  return Object.entries(keywordCounts)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 keywords
}

/**
 * Process streaming chunk for all insight types
 * @param {string} chunk - New streaming text chunk
 * @param {string} modelId - Model that generated the chunk
 * @param {Object} options - Additional options
 * @returns {Object} {cleanedText, newInsights}
 */
export function processStreamingChunk(chunk, modelId, options = {}) {
  const { contextKeywords = [] } = options;

  // Extract gaps
  const gapInsights = extractGaps(chunk, modelId);

  // Detect context references
  const contextInsights = detectContextReferences(chunk, modelId, contextKeywords);

  // Clean the text
  const cleanedText = cleanGapMarkers(chunk);

  return {
    cleanedText,
    newInsights: [...gapInsights, ...contextInsights]
  };
}

/**
 * Analyze completed responses for patterns
 * @param {Array<Object>} responses - Array of {modelId, text} objects
 * @returns {Array<Object>} All detected insights
 */
export function analyzeResponses(responses) {
  const consensusInsights = detectConsensus(responses);
  const tensionInsights = detectTensions(responses);

  return [...consensusInsights, ...tensionInsights];
}
