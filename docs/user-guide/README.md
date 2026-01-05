# AxCouncil User Guide

Welcome to AxCouncil - the AI-powered decision council platform that helps you make better decisions by consulting multiple AI experts.

## What is AxCouncil?

AxCouncil is a unique AI platform that doesn't just give you one AI's opinion - it convenes a **council of 5 AI experts** who debate, review each other's responses, and synthesize the best answer for you.

### The 3-Stage Process

```
Stage 1: Individual Responses
├── 5 AI models respond to your question independently
├── Claude, GPT, Gemini, Grok, and DeepSeek
└── Each brings unique perspectives and expertise

Stage 2: Peer Review
├── AI models anonymously review each other
├── They rank responses by quality and relevance
└── Identifies the strongest arguments

Stage 3: Chairman Synthesis
├── A senior AI synthesizes all insights
├── Creates one comprehensive answer
└── Highlights key recommendations
```

**Why this works**: Different AI models have different strengths. By combining their perspectives and having them critique each other, you get more balanced, thorough answers than any single AI could provide.

---

## Quick Start

### 1. Sign In

- Visit [axcouncil.com](https://axcouncil.com)
- Click **Sign in with Google** or enter your email
- You're ready to consult the council!

### 2. Ask Your First Question

1. Type your question in the input bar at the bottom
2. Click the **Send** button or press Enter
3. Watch as 5 AI experts respond, then review each other
4. Read the final synthesized answer

**Pro tip**: Ask complex, high-stakes questions where multiple perspectives matter. The council excels at:
- Strategic decisions
- Weighing trade-offs
- Exploring options you hadn't considered

### 3. Add Your Company Context

For personalized answers that understand your business:

1. Click the **Company** icon in the input bar
2. Select **+ Add Company**
3. Fill in your company details and context
4. Now all council responses will consider your specific situation

---

## Features

### Council Mode vs Chat Mode

| Mode | What It Does | Best For |
|------|-------------|----------|
| **Council** | 5 AI models + peer review + synthesis | Important decisions, complex questions |
| **Chat** | Single AI quick response | Simple questions, follow-ups |

Toggle between modes using the switch in the input bar.

### Company Context

Add your company information so the AI council understands:
- Your industry and market
- Business goals and constraints
- Team structure and roles
- Key challenges

**How to set up:**
1. Click **My Company** in the navigation
2. Go to **Overview** tab
3. Add your company context in markdown format

### Departments

Organize your councils by department for specialized expertise:
- **Marketing** - Campaign ideas, messaging, positioning
- **Sales** - Deal strategy, objection handling, proposals
- **Legal** - Contract review, compliance questions
- **Executive** - Strategic decisions, board prep

Each department can have its own context and AI role configurations.

### Playbooks

Playbooks are reusable documents that get automatically injected into your council's context:

| Type | Purpose | Example |
|------|---------|---------|
| **SOP** | Standard procedures | "Sales call framework" |
| **Framework** | Decision models | "Hiring evaluation criteria" |
| **Policy** | Guidelines | "Brand voice guidelines" |

**To create a playbook:**
1. Go to **My Company** → **Playbooks**
2. Click **+ New Playbook**
3. Choose type and add content
4. Enable **Auto-inject** to include it automatically

### Saving Decisions

After getting a council response, you can save it for future reference:

1. Click **Save** on any council response
2. Add a title and optional tags
3. Choose to make it a **Decision** (archived) or **Promote** to a playbook

Saved decisions appear in **My Company** → **Decisions**.

---

## Tips & Best Practices

### Writing Great Questions

**Instead of:** "How do I grow my business?"

**Try:** "We're a B2B SaaS company with $2M ARR, 50% YoY growth, and a sales team of 5. What are the top 3 strategies to accelerate growth to $5M ARR in 18 months, considering we have limited marketing budget?"

**Key elements:**
- Specific context
- Clear constraints
- Measurable goal
- Defined scope

### Getting the Most from Context

The more context you provide, the better the answers:

1. **Company context**: Industry, size, stage, unique challenges
2. **Department context**: Team structure, current priorities
3. **Playbooks**: Your frameworks, processes, brand guidelines
4. **Project context**: Specific initiative details

### Using the Sidebar

- **Search**: Find past conversations quickly
- **Star**: Mark important conversations
- **Archive**: Clean up without deleting
- **Filter**: Show only starred or archived

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + N` | New conversation |
| `Cmd/Ctrl + K` | Focus search |
| `Enter` | Send message |
| `Shift + Enter` | New line in message |
| `Escape` | Close modal/popover |

---

## FAQ

### How is this different from ChatGPT?

AxCouncil uses **5 different AI models** that debate and review each other, then synthesizes the best answer. You get multiple perspectives, not just one AI's opinion.

### Which AI models are used?

- **Claude Opus 4.5** (Anthropic) - Strong reasoning
- **GPT-5.1** (OpenAI) - Broad knowledge
- **Gemini 3 Pro** (Google) - Technical depth
- **Grok 4** (xAI) - Direct, unconventional thinking
- **DeepSeek R1** - Analytical reasoning

### Is my data private?

Yes. Your conversations and company context are stored securely with:
- Row-level security (RLS) in the database
- Encryption at rest and in transit
- No training on your data

### Can I use my own API keys?

Yes! Go to **Settings** → **API Keys** to add your own OpenRouter key. This gives you full control over usage and billing.

### How much does it cost?

AxCouncil uses a query-based pricing model. Each council consultation uses tokens from multiple AI models. Check **My Company** → **Usage** for your current usage.

---

## Troubleshooting

### Response is taking too long

The 3-stage process takes 30-60 seconds because it's running 5+ AI calls. This is normal. You'll see progress indicators for each stage.

### Context isn't being applied

1. Make sure you've selected a **Company** in the input bar
2. Check that playbooks have **Auto-inject** enabled
3. Verify your company context is saved (not just typed)

### Error: "Rate limit exceeded"

You've hit the usage limit. Wait a few minutes or upgrade your plan. Enterprise users have higher limits.

---

## Getting Help

- **In-app**: Click the **?** icon for contextual help
- **Documentation**: You're reading it!
- **Issues**: [GitHub Issues](https://github.com/BuDozKeN/AI-council/issues)
- **Discussions**: [GitHub Discussions](https://github.com/BuDozKeN/AI-council/discussions)

---

## Next Steps

- [Getting Started Tutorial](./getting-started.md)
- [Company Setup Guide](./company-setup.md)
- [Playbooks Guide](./playbooks.md)
- [Best Practices](./best-practices.md)

---

*Built with AI assistance using Claude Code.*
