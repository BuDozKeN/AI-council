# Frequently Asked Questions

Quick answers to common questions about AxCouncil.

---

## General

### What is AxCouncil?

AxCouncil is an AI decision-making platform that consults **5 different AI models** (Claude, GPT, Gemini, Grok, DeepSeek), has them review each other's responses, and synthesizes the best answer. It's like having a board of AI advisors debate your questions.

### How is this different from ChatGPT or Claude?

| Regular AI Chat | AxCouncil |
|-----------------|-----------|
| 1 AI model | 5 AI models |
| Single perspective | Multiple perspectives |
| Direct response | Peer-reviewed response |
| Generic context | Your company context |

### Why use multiple AI models?

Different AI models have different:
- **Training data**: Some know more about certain topics
- **Reasoning styles**: Some are more creative, others more analytical
- **Biases**: Multiple models balance each other out
- **Strengths**: Claude for writing, GPT for breadth, Gemini for technical depth

By combining them and having them critique each other, you get more balanced, thorough answers.

---

## The 3-Stage Process

### What happens in Stage 1?

Five AI models receive your question simultaneously and respond independently. Each brings its unique perspective without seeing what the others wrote.

### What happens in Stage 2?

The AI models anonymously review each other's responses. They rank which responses are best and identify strengths and weaknesses. This peer review catches errors and highlights the strongest arguments.

### What happens in Stage 3?

A "chairman" AI model reads all responses and peer reviews, then synthesizes a final answer that:
- Combines the best insights from all models
- Resolves conflicting recommendations
- Provides a clear, actionable conclusion

### Why does it take 30-60 seconds?

We're running 5+ AI calls sequentially:
- Stage 1: 5 parallel API calls (15-20s)
- Stage 2: 3 review calls (10-15s)
- Stage 3: 1 synthesis call (5-10s)

Quality takes time. Use **Chat mode** for faster, single-model responses.

---

## Company Context

### Why should I add company context?

Without context, you get generic advice. With context:

**Before**: "Consider A/B testing your pricing"
**After**: "Given your 12-month runway and 50 beta users, avoid complex pricing experiments. Instead, validate willingness-to-pay through customer calls."

### What should I include in my context?

- Company overview and mission
- Stage and key metrics (revenue, team size, runway)
- Target market and ICP
- Current challenges
- Constraints (budget, time, resources)
- Goals

See [Company Setup Guide](./company-setup.md) for templates.

### Is my company data secure?

Yes:
- Data encrypted at rest and in transit
- Row-level security (RLS) in database
- Your data is never used to train AI models
- HTTPS everywhere
- SOC 2-ready architecture

---

## Playbooks & Decisions

### What are Playbooks?

Playbooks are reusable documents that get automatically injected into your council's context. Types:
- **SOP**: Standard operating procedures
- **Framework**: Decision-making models
- **Policy**: Guidelines and rules

### How do I create a Playbook?

1. Go to **My Company** → **Playbooks**
2. Click **+ New Playbook**
3. Select type, add title and content
4. Enable **Auto-inject** to include automatically

### What are Decisions?

Decisions are saved council responses that become part of your knowledge base. You can:
- Reference past decisions
- Promote decisions to playbooks
- Track how your thinking evolved

### Can I search past decisions?

Yes! Use the sidebar search to find past conversations and saved decisions.

---

## Pricing & Usage

### How much does it cost?

AxCouncil uses a query-based pricing model. Each council consultation uses tokens across multiple AI models. Check **My Company** → **Usage** for your current usage.

### Can I use my own API keys?

Yes! Go to **Settings** → **API Keys** to add your own OpenRouter key. This gives you:
- Full control over usage
- Direct billing with OpenRouter
- Higher rate limits

### What are the rate limits?

Free tier: ~50 council queries/day
With your own key: Based on your OpenRouter limits

### Is there a free trial?

Yes, new accounts get free queries to try the platform.

---

## Technical

### Which AI models are used?

| Model | Provider | Strengths |
|-------|----------|-----------|
| Claude Opus 4.5 | Anthropic | Reasoning, writing, analysis |
| GPT-5.1 | OpenAI | Broad knowledge, instruction following |
| Gemini 3 Pro | Google | Technical depth, data analysis |
| Grok 4 | xAI | Direct, unconventional perspectives |
| DeepSeek R1 | DeepSeek | Analytical reasoning, cost-effective |

### Can I choose which models to use?

Currently, the default council of 5 models is fixed. Model selection is on the roadmap.

### Does AxCouncil work offline?

No, you need an internet connection to access the AI models.

### What browsers are supported?

- Chrome (recommended)
- Firefox
- Safari
- Edge

Mobile browsers are supported with responsive design.

---

## Troubleshooting

### My query is stuck at Stage 1

This usually means an AI model is slow or timing out:
1. Wait up to 2 minutes
2. If stuck, refresh and try again
3. Simplify your query if it's very complex

### Context isn't being applied

1. Make sure you've **saved** the context
2. Verify the company is **selected** in the input bar
3. Check that playbooks have **Auto-inject** enabled
4. Refresh the page

### "Rate limit exceeded" error

You've hit the usage limit:
1. Wait a few minutes
2. Add your own API key in Settings
3. Upgrade your plan for higher limits

### Response quality seems low

Try these improvements:
1. Add more specific context
2. Make your question more detailed
3. Include constraints and goals
4. Enable relevant playbooks

---

## Account & Privacy

### How do I delete my account?

Go to **Settings** → **Privacy** → **Delete Account**. This permanently removes all your data.

### Can I export my data?

Yes, you can export:
- Conversations (JSON or Markdown)
- Saved decisions
- Company context

### Who can see my data?

Only you. AxCouncil uses row-level security (RLS) to ensure users can only access their own data. Admins cannot see your conversations.

### Is my data used to train AI?

No. Your queries and company context are never used to train AI models. They are only used to generate your responses.

---

## Feature Requests

### How do I request a feature?

Open a [GitHub Discussion](https://github.com/BuDozKeN/AI-council/discussions) or [Issue](https://github.com/BuDozKeN/AI-council/issues).

### What's on the roadmap?

Check the [GitHub project board](https://github.com/BuDozKeN/AI-council/projects) for planned features.

### Can I contribute?

Yes! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

---

## Still Have Questions?

- **Documentation**: [User Guide](./README.md)
- **GitHub Issues**: [Report a bug](https://github.com/BuDozKeN/AI-council/issues)
- **Discussions**: [Ask the community](https://github.com/BuDozKeN/AI-council/discussions)
