# AxCouncil Content Studio - The $25M Roadmap

> **Vision**: Build a fully integrated AI-powered content platform where 5 flagship models debate and create enterprise-grade content - blogs, social media, images, and videos - all from one brief.

> **Tagline**: "Every piece of content debated by Claude, GPT, Gemini, Grok, and DeepSeek before publication."

---

## Table of Contents

1. [The Vision](#the-vision)
2. [Value Proposition](#value-proposition)
3. [Architecture Overview](#architecture-overview)
4. [Content Studio Features](#content-studio-features)
5. [Research Layer (Perplexity)](#research-layer-perplexity)
6. [AI Image Generation](#ai-image-generation)
7. [AI Video Generation](#ai-video-generation)
8. [Social Media Publishing](#social-media-publishing)
9. [n8n Automation](#n8n-automation)
10. [Database Schema](#database-schema)
11. [Brand Playbook System](#brand-playbook-system)
12. [Content Templates](#content-templates)
13. [SEO & AEO Integration](#seo--aeo-integration)
14. [Implementation Phases](#implementation-phases)
15. [Cost Analysis](#cost-analysis)
16. [The Moat](#the-moat)

---

## The Vision

### What We're Building

A unified content operations platform where:

```
One Brief → Research → Council Debate → Multi-Platform Content → Auto-Publish

Input:  "Write about AI agents disrupting enterprise software"
Output:
├── Blog post (1500 words, SEO-optimized, cited sources)
├── LinkedIn post (400 words, professional tone)
├── Twitter/X thread (6 tweets, punchy)
├── Newsletter snippet (150 words)
├── Hero image (AI-generated, on-brand)
├── Social cards (3 variants)
├── 15-second video (optional)
└── All scheduled and published automatically
```

### Why This Matters

- **We eat our own dog food**: Our entire marketing is created by our platform
- **Unique differentiator**: No one else has 5 AI models debating content
- **Full control**: Self-hosted, no vendor lock-in
- **Enterprise-ready**: Approval workflows, audit trails, scheduling

---

## Value Proposition

### For AxCouncil (Internal)

| Benefit | Impact |
|---------|--------|
| Showcase platform capability | "Our blog is written by our council" |
| SEO surface area | More pages = more search visibility |
| Content velocity | 10x faster content production |
| Consistency | Brand voice enforced by playbook |
| Cost savings | Replace Buffer, Hootsuite, content agencies |

### For Future Customers (Product Feature)

| Benefit | Impact |
|---------|--------|
| Multi-model content quality | Better than single-model output |
| Real-time research | Content based on today's news |
| Multi-platform from one brief | 5x efficiency gain |
| Automated publishing | Zero manual work |
| Cited sources | E-E-A-T credibility |

### What We Replace

| Tool | Cost/Month | AxCouncil Replaces |
|------|------------|-------------------|
| Buffer/Hootsuite | $50-200 | ✅ Social scheduling |
| Jasper/Copy.ai | $50-500 | ✅ AI content generation |
| Canva Pro | $15 | ✅ Social cards, OG images |
| Stock photos | $30-200 | ✅ AI-generated images |
| Content agencies | $2000-10000 | ✅ Full content production |
| **Total replaced** | **$2,145-10,915/mo** | |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AxCouncil Platform                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Content Studio                               │    │
│  │                                                                      │    │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │    │
│  │  │  Brief   │ → │ Research │ → │ Council  │ → │ Content + Media  │ │    │
│  │  │  Input   │   │(Perplexity)  │ (5 Models)   │ Generation       │ │    │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────────────┘ │    │
│  │                                                         │          │    │
│  │                                                         ▼          │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │                    Review & Approve                           │ │    │
│  │  │  [Blog ✓] [LinkedIn ✓] [Twitter ✓] [Images ✓] [Video ✓]     │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  │                                      │                             │    │
│  └──────────────────────────────────────│─────────────────────────────┘    │
│                                         │                                   │
│                                         ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         n8n (Self-Hosted)                             │  │
│  │                                                                       │  │
│  │  Workflows:                                                           │  │
│  │  ├── Generate Images (Flux Pro, Imagen 3, Ideogram)                  │  │
│  │  ├── Generate Videos (Kling, Runway)                                  │  │
│  │  ├── Publish Blog (SSG rebuild trigger)                              │  │
│  │  ├── Post to LinkedIn (API)                                          │  │
│  │  ├── Post to Twitter/X (API)                                         │  │
│  │  ├── Send Newsletter (Resend/Mailchimp)                              │  │
│  │  └── Log Analytics (back to Supabase)                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Public Website                                │  │
│  │                                                                       │  │
│  │  Static/SSR Pages (SEO-optimized):                                   │  │
│  │  ├── / (Homepage)                                                    │  │
│  │  ├── /features                                                       │  │
│  │  ├── /pricing                                                        │  │
│  │  ├── /about                                                          │  │
│  │  ├── /blog (list)                                                    │  │
│  │  ├── /blog/:slug (articles)                                          │  │
│  │  ├── /privacy                                                        │  │
│  │  ├── /terms                                                          │  │
│  │  └── /contact                                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Supabase (Database)                           │  │
│  │                                                                       │  │
│  │  Existing: users, companies, conversations, decisions, playbooks     │  │
│  │  New: content_items, content_research, media_assets, social_posts,   │  │
│  │       form_submissions, content_templates, content_analytics         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Content Studio Features

### Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Content Editor** | Rich text/markdown editor with preview | P0 |
| **Generate with Council** | Send brief to 5-model debate | P0 |
| **Research Integration** | Perplexity search before council | P0 |
| **Multi-Platform Output** | Blog + Social + Newsletter from one brief | P0 |
| **Media Generation** | AI images and videos | P1 |
| **Draft/Review/Publish** | Workflow states with approval | P0 |
| **Version History** | Track all revisions | P1 |
| **Scheduling** | Schedule publish date/time | P1 |
| **Templates** | Pre-built content structures | P0 |
| **Brand Playbook** | Style/voice rules council follows | P0 |

### Content Types Supported

| Type | Output Format | Platforms |
|------|---------------|-----------|
| **Blog Post** | Markdown/HTML | Website |
| **Feature Page** | Markdown/HTML | Website |
| **Landing Page** | Markdown/HTML | Website |
| **LinkedIn Post** | Plain text + image | LinkedIn |
| **Twitter Thread** | Array of tweets | Twitter/X |
| **Newsletter** | HTML email | Email |
| **Press Release** | Markdown | Website, PR distribution |
| **Case Study** | Markdown/HTML | Website |
| **Documentation** | Markdown | Website/Docs |

### Workflow States

```
Draft → In Review → Approved → Scheduled → Published → Archived
  │         │           │          │           │
  └─────────┴───────────┴──────────┴───────────┘
            (can return to Draft for edits)
```

---

## Research Layer (Perplexity)

### Why Perplexity First

| Problem | Solution |
|---------|----------|
| AI models have training cutoffs | Perplexity searches live web |
| Content may be outdated | Real-time data and news |
| No citations | Perplexity provides sources |
| Hallucinations | Facts verified by search |

### Perplexity API Integration

```typescript
interface PerplexityResearch {
  query: string;
  recency: 'day' | 'week' | 'month' | 'year';
  focus: 'news' | 'academic' | 'general';
}

interface PerplexityResponse {
  summary: string;
  key_facts: string[];
  citations: {
    url: string;
    title: string;
    snippet: string;
  }[];
  raw_content: string;
}

async function researchTopic(config: PerplexityResearch): Promise<PerplexityResponse> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{
        role: 'system',
        content: `You are a research assistant. Gather comprehensive, factual information
                  about the topic. Focus on recent developments, statistics, and cite all sources.`
      }, {
        role: 'user',
        content: `Research the following topic for a ${config.focus} article.
                  Focus on developments from the last ${config.recency}.
                  Include specific facts, statistics, quotes, and cite all sources.

                  Topic: ${config.query}`
      }],
      search_recency_filter: config.recency,
      return_citations: true
    })
  });

  return response.json();
}
```

### Research UI Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Research                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Brief: "AI agents in enterprise software 2026"             │
│                                                              │
│  Research Settings:                                          │
│  ┌────────────────┐  ┌────────────────┐                     │
│  │ Recency: Week ▼│  │ Focus: News   ▼│                     │
│  └────────────────┘  └────────────────┘                     │
│                                                              │
│  [ Start Research ]                                          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Research Results:                                           │
│                                                              │
│  Key Findings:                                               │
│  • OpenAI launched Operator agent (Jan 19, 2026)            │
│  • Anthropic Claude workflows: 50-step execution            │
│  • Market size: $28B projected by 2028 (Gartner)            │
│  • Microsoft Copilot Studio: 340% Q4 growth                 │
│                                                              │
│  Sources (4):                                                │
│  ☑ techcrunch.com/openai-operator-launch                    │
│  ☑ anthropic.com/news/claude-workflows                       │
│  ☑ gartner.com/ai-agents-forecast                           │
│  ☑ microsoft.com/copilot-studio-growth                       │
│                                                              │
│  [ Edit Research ]  [ Approve & Continue to Council ]       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Cost

- **Perplexity Sonar Pro**: ~$5 per 1000 requests
- **Per article**: ~$0.005 (half a cent)
- **Monthly (100 articles)**: ~$0.50

---

## AI Image Generation

### Providers (Premium Tier)

| Provider | Model | Best For | Quality | Cost | API |
|----------|-------|----------|---------|------|-----|
| **Flux Pro** | Flux.1 Pro | Hero images, marketing | ★★★★★ | $0.05/img | Replicate, BFL |
| **Imagen 3** | Imagen 3 | Product shots, brand-safe | ★★★★★ | $0.04/img | Google Vertex |
| **Ideogram** | Ideogram 2.0 | Text in images, logos | ★★★★☆ | $0.08/img | Official API |
| **DALL-E 3** | DALL-E 3 | Quick integration | ★★★★☆ | $0.04-0.12/img | OpenAI API |
| **Midjourney** | v6 | Artistic, stylized | ★★★★★ | $0.05/img | Unofficial |

### Recommended Stack

| Use Case | Provider | Why |
|----------|----------|-----|
| **Blog hero images** | Flux Pro | Best quality, photorealistic |
| **Product visuals** | Imagen 3 | Google quality, brand-safe |
| **Social cards with text** | Ideogram 2.0 | Handles text beautifully |
| **OG images** | Template-based | Fast, consistent, free |
| **Thumbnails** | Flux Pro | Quality at any size |

### Image Generation Flow

```typescript
interface ImageRequest {
  prompt: string;
  provider: 'flux' | 'imagen' | 'ideogram' | 'dalle';
  aspect_ratio: '1:1' | '16:9' | '9:16' | '4:3';
  style?: string;
}

// Council generates optimized prompts
const heroImagePrompt = `
  Minimalist tech illustration, five glowing AI nodes connected
  in a circular formation, collaborative energy flowing between them,
  clean white background, subtle blue and purple gradients,
  professional corporate aesthetic, no text, 16:9 aspect ratio,
  high detail, cinematic lighting
`;

// n8n workflow calls appropriate API
async function generateImage(request: ImageRequest): Promise<string> {
  switch (request.provider) {
    case 'flux':
      return await generateWithFlux(request);
    case 'imagen':
      return await generateWithImagen(request);
    case 'ideogram':
      return await generateWithIdeogram(request);
    case 'dalle':
      return await generateWithDalle(request);
  }
}
```

### OG Image Templates (Free, Fast)

For consistent social cards, use template-based generation:

```typescript
// Template-based OG image (using @vercel/og or similar)
interface OGImageConfig {
  title: string;
  subtitle?: string;
  category?: string;
  brandColors: boolean;
  template: 'blog' | 'feature' | 'announcement';
}

// Generates consistent 1200x630 images instantly
function generateOGImage(config: OGImageConfig): ImageResponse {
  return new ImageResponse(
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '60px',
    }}>
      <div style={{ color: '#8b5cf6', fontSize: '24px' }}>
        {config.category}
      </div>
      <div style={{ color: 'white', fontSize: '64px', fontWeight: 'bold' }}>
        {config.title}
      </div>
      <div style={{ color: '#a1a1aa', fontSize: '32px' }}>
        {config.subtitle}
      </div>
      <div style={{ position: 'absolute', bottom: '40px', right: '60px' }}>
        <img src="/logo.svg" width="150" />
      </div>
    </div>
  );
}
```

---

## AI Video Generation

### Providers (Premium Tier)

| Provider | Model | Best For | Quality | Cost | API |
|----------|-------|----------|---------|------|-----|
| **Kling** | Kling 1.5 | Cinematic, realistic motion | ★★★★★ | $0.30/sec | Official |
| **Runway** | Gen-3 Alpha | Control, professional | ★★★★★ | $0.50/sec | Official |
| **Veo 2** | Veo 2 | Highest quality | ★★★★★ | Premium | Google |
| **Pika** | Pika 1.5 | Quick clips, stylized | ★★★★☆ | $0.20/sec | Official |
| **Luma** | Dream Machine | Fast generation | ★★★★☆ | $0.25/sec | Official |
| **Sora** | Sora | Best overall (limited) | ★★★★★ | TBD | OpenAI |

### Recommended Stack

| Use Case | Provider | Why |
|----------|----------|-----|
| **Product demos** | Kling 1.5 | Best quality/cost ratio |
| **Social clips** | Runway Gen-3 | Professional, controllable |
| **Premium ads** | Veo 2 | Highest quality |
| **Quick teasers** | Pika 1.5 | Fast, stylized |

### Video Generation Flow

```typescript
interface VideoRequest {
  prompt: string;
  provider: 'kling' | 'runway' | 'veo' | 'pika';
  duration: number; // seconds
  aspect_ratio: '16:9' | '9:16' | '1:1';
  style?: 'cinematic' | 'corporate' | 'dynamic';
}

// Council generates video prompts
const videoPrompt = `
  Smooth camera push into a futuristic holographic roundtable,
  five distinct AI entities represented as glowing orbs with unique colors,
  data streams and insights flowing between them,
  one orb highlights and presents a solution,
  cinematic lighting, tech-forward aesthetic,
  professional corporate mood, 15 seconds
`;

// n8n handles generation (async, can take minutes)
async function generateVideo(request: VideoRequest): Promise<string> {
  const job = await startVideoGeneration(request);
  // Poll for completion or use webhook
  return await waitForCompletion(job.id);
}
```

### When to Use Video

| Content Type | Video? | Why |
|--------------|--------|-----|
| Blog post | Optional | Hero video for premium posts |
| Product launch | Yes | Announcement clip |
| Social media | Yes (15s) | High engagement |
| Ads | Yes | Required for video ads |
| Documentation | No | Text/images sufficient |

---

## Social Media Publishing

### Platforms Supported

| Platform | API | Content Type | Automation |
|----------|-----|--------------|------------|
| **LinkedIn** | Official | Posts, Articles, Images | Full |
| **Twitter/X** | Official | Tweets, Threads, Images | Full |
| **Facebook** | Official | Posts, Images | Full |
| **Instagram** | Official | Posts, Stories, Reels | Partial |
| **YouTube** | Official | Videos, Shorts | Full |
| **TikTok** | Official | Videos | Full |

### Content Adaptation by Platform

```
Original Blog Post (1500 words)
│
├── LinkedIn Post (300-500 words)
│   ├── Professional tone
│   ├── Industry insights focus
│   ├── 3-5 hashtags
│   └── CTA to full article
│
├── Twitter Thread (5-7 tweets)
│   ├── Punchy, hook-first
│   ├── One key insight per tweet
│   ├── Relevant hashtags
│   └── Link in last tweet
│
├── Newsletter Snippet (150 words)
│   ├── Teaser/summary
│   ├── Key takeaway
│   └── CTA to read more
│
└── Instagram Caption (150 words)
    ├── Engaging hook
    ├── Value proposition
    ├── 10-15 hashtags
    └── CTA
```

### Social Post Database Schema

```sql
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id),
  platform TEXT NOT NULL, -- 'linkedin', 'twitter', 'facebook', 'instagram'
  content TEXT NOT NULL,
  media_urls TEXT[], -- Attached images/videos
  hashtags TEXT[],
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft', -- draft, scheduled, published, failed
  platform_post_id TEXT, -- ID from platform after posting
  platform_url TEXT, -- URL to the live post
  analytics JSONB, -- Likes, shares, comments, impressions
  error_message TEXT, -- If failed
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for scheduling queries
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at)
  WHERE status = 'scheduled';
```

---

## n8n Automation

### Why n8n (Self-Hosted)

| Factor | n8n | Zapier/Make |
|--------|-----|-------------|
| **Self-hosted** | ✅ Full control | ❌ Their servers |
| **Cost** | Free (self-host) | $$$$ at scale |
| **Data privacy** | Your infrastructure | Third party |
| **Custom nodes** | Build your own | Limited |
| **Enterprise-ready** | ✅ | Depends on plan |
| **Complexity** | Handles complex flows | Limited branching |

### n8n Workflows

#### Workflow 1: Content Publishing

```
Trigger: Webhook from AxCouncil (content approved)
│
├── Parse content by type (blog, social, newsletter)
│
├── [Branch: Blog Post]
│   ├── Generate hero image (Flux Pro)
│   ├── Generate OG image (template)
│   ├── Store in Supabase
│   └── Trigger SSG rebuild (Vercel/Netlify hook)
│
├── [Branch: LinkedIn]
│   ├── Generate social card (Ideogram)
│   ├── Post via LinkedIn API
│   └── Store post ID in Supabase
│
├── [Branch: Twitter]
│   ├── Parse into thread
│   ├── Post thread via Twitter API
│   └── Store thread IDs in Supabase
│
├── [Branch: Newsletter]
│   ├── Add to email queue (Resend/Mailchimp)
│   └── Log in Supabase
│
└── Notify AxCouncil (webhook): All published
```

#### Workflow 2: Image Generation

```
Trigger: Webhook from AxCouncil (image requested)
│
├── Parse image type and provider
│
├── [Switch: Provider]
│   ├── Flux Pro → Replicate API
│   ├── Imagen 3 → Google Vertex AI
│   ├── Ideogram → Ideogram API
│   └── DALL-E → OpenAI API
│
├── Wait for generation (poll or webhook)
│
├── Upload to storage (Supabase Storage / S3)
│
└── Update Supabase with image URL
```

#### Workflow 3: Video Generation

```
Trigger: Webhook from AxCouncil (video requested)
│
├── Start video generation (Kling/Runway API)
│
├── Store job ID in Supabase (status: generating)
│
└── [Separate workflow - polling]
    ├── Check job status every 30 seconds
    ├── On complete: Download video
    ├── Upload to storage
    ├── Update Supabase with video URL
    └── Notify AxCouncil
```

#### Workflow 4: Analytics Collection

```
Trigger: Scheduled (daily at 6 AM)
│
├── Fetch all published social posts
│
├── For each post:
│   ├── LinkedIn: Get post analytics
│   ├── Twitter: Get tweet metrics
│   └── Update Supabase analytics JSONB
│
└── Generate daily report (optional email)
```

### n8n Setup (Docker)

```yaml
# docker-compose.yml for n8n
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${N8N_HOST}/
      - GENERIC_TIMEZONE=UTC
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

---

## Database Schema

### New Tables for Content Studio

```sql
-- =====================================================
-- CONTENT ITEMS (Main content table)
-- =====================================================
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,

  -- Content identification
  type TEXT NOT NULL, -- 'blog', 'feature_page', 'landing', 'press_release', 'case_study'
  slug TEXT NOT NULL,

  -- Content data
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL, -- Markdown or HTML
  excerpt TEXT, -- Short summary for listings

  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[],
  canonical_url TEXT,

  -- Media
  hero_image_id UUID REFERENCES media_assets(id),
  og_image_id UUID REFERENCES media_assets(id),

  -- Research (if used)
  research_id UUID REFERENCES content_research(id),

  -- Template used
  template_id UUID REFERENCES content_templates(id),

  -- Publishing
  status TEXT DEFAULT 'draft', -- draft, in_review, approved, scheduled, published, archived
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,

  -- Author
  author_id UUID REFERENCES users(id),

  -- Categorization
  category TEXT,
  tags TEXT[],

  -- Metadata
  word_count INTEGER,
  reading_time_minutes INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, slug)
);

-- =====================================================
-- CONTENT VERSIONS (Revision history)
-- =====================================================
CREATE TABLE content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Snapshot of content at this version
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Who made this version
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Change description
  change_summary TEXT,

  UNIQUE(content_item_id, version_number)
);

-- =====================================================
-- CONTENT RESEARCH (Perplexity results)
-- =====================================================
CREATE TABLE content_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,

  -- Query
  query TEXT NOT NULL,
  recency_filter TEXT, -- 'day', 'week', 'month', 'year'
  focus TEXT, -- 'news', 'academic', 'general'

  -- Results
  summary TEXT,
  key_facts JSONB, -- Array of facts
  citations JSONB, -- Array of {url, title, snippet}

  -- Raw response for debugging
  raw_response JSONB,

  -- Provider
  provider TEXT DEFAULT 'perplexity',
  model TEXT DEFAULT 'sonar-pro',

  -- Cost tracking
  tokens_used INTEGER,
  cost_cents INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MEDIA ASSETS (Images, Videos)
-- =====================================================
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  content_item_id UUID REFERENCES content_items(id), -- Optional link

  -- Type
  type TEXT NOT NULL, -- 'image', 'video'
  subtype TEXT, -- 'hero', 'og', 'social_card', 'product_demo'

  -- Generation
  provider TEXT NOT NULL, -- 'flux', 'imagen', 'ideogram', 'dalle', 'kling', 'runway'
  prompt TEXT NOT NULL,

  -- Storage
  url TEXT, -- Final URL
  thumbnail_url TEXT,
  storage_path TEXT, -- Path in Supabase Storage / S3

  -- Metadata
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER, -- For videos
  file_size_bytes INTEGER,
  mime_type TEXT,

  -- Status
  status TEXT DEFAULT 'pending', -- pending, generating, complete, failed
  error_message TEXT,

  -- Cost
  cost_cents INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SOCIAL POSTS (LinkedIn, Twitter, etc.)
-- =====================================================
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id),
  company_id UUID REFERENCES companies(id) NOT NULL,

  -- Platform
  platform TEXT NOT NULL, -- 'linkedin', 'twitter', 'facebook', 'instagram'

  -- Content
  content TEXT NOT NULL,
  media_asset_ids UUID[], -- References to media_assets
  hashtags TEXT[],
  mentions TEXT[], -- @handles
  link_url TEXT,

  -- Thread support (Twitter)
  thread_position INTEGER, -- Position in thread (1, 2, 3...)
  thread_parent_id UUID REFERENCES social_posts(id),

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'draft', -- draft, scheduled, published, failed

  -- Platform response
  platform_post_id TEXT,
  platform_url TEXT,
  error_message TEXT,

  -- Analytics (updated periodically)
  analytics JSONB, -- {likes, shares, comments, impressions, clicks}

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CONTENT TEMPLATES
-- =====================================================
CREATE TABLE content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id), -- NULL for system templates

  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'blog', 'feature_page', 'landing', etc.

  -- Structure
  structure JSONB NOT NULL, -- Defines sections and their order
  /*
    Example structure:
    {
      "sections": [
        {"name": "hero", "type": "text", "required": true},
        {"name": "introduction", "type": "markdown", "required": true, "max_words": 150},
        {"name": "main_content", "type": "markdown", "required": true},
        {"name": "key_takeaways", "type": "list", "required": false},
        {"name": "cta", "type": "text", "required": true}
      ]
    }
  */

  -- Prompts for council
  generation_prompts JSONB, -- Prompts for each section

  -- Default SEO
  default_meta_title_template TEXT, -- "{{title}} | AxCouncil Blog"
  default_meta_description_template TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FORM SUBMISSIONS (Contact, Newsletter, etc.)
-- =====================================================
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),

  -- Form identification
  form_type TEXT NOT NULL, -- 'contact', 'newsletter', 'demo_request'

  -- Submission data
  data JSONB NOT NULL, -- {email, name, message, etc.}

  -- Source
  source_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Processing
  status TEXT DEFAULT 'new', -- new, processed, spam
  processed_at TIMESTAMPTZ,

  -- IP and basic info (for spam prevention)
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CONTENT ANALYTICS
-- =====================================================
CREATE TABLE content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,

  -- Date for aggregation
  date DATE NOT NULL,

  -- Metrics
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_time_on_page_seconds INTEGER,
  bounce_rate DECIMAL(5,2),
  scroll_depth_avg DECIMAL(5,2),

  -- Sources
  traffic_sources JSONB, -- {organic: 100, social: 50, direct: 25}

  -- Engagement
  social_shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(content_item_id, date)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_content_items_company ON content_items(company_id);
CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_content_items_published ON content_items(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_content_items_slug ON content_items(slug);

CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_social_posts_platform ON social_posts(platform);

CREATE INDEX idx_media_assets_content ON media_assets(content_item_id);
CREATE INDEX idx_media_assets_status ON media_assets(status);

CREATE INDEX idx_form_submissions_type ON form_submissions(form_type);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analytics ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their company's content
CREATE POLICY content_items_company_isolation ON content_items
  FOR ALL USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- Similar policies for other tables...
```

---

## Brand Playbook System

### Purpose

The Brand Playbook is a special playbook that the council reads before generating any content. It ensures consistency in:

- Voice and tone
- Writing style
- Visual guidelines
- Terminology
- Formatting rules

### Playbook Structure

```markdown
# AxCouncil Brand & Content Playbook

## Voice & Tone

### Our Voice Is:
- **Professional but approachable** - We're experts, not academics
- **Confident, not arrogant** - We know our stuff, but we don't brag
- **Clear, not dumbed-down** - Technical accuracy without unnecessary jargon
- **Helpful, not salesy** - We educate first, sell second

### Our Voice Is NOT:
- Stiff or corporate
- Overly casual or using slang
- Condescending or preachy
- Hype-driven or clickbaity

## Writing Rules

### Headlines
- Maximum 8 words
- Action-oriented or benefit-focused
- No clickbait or misleading promises
- Examples:
  - ✅ "How AI Councils Make Better Decisions"
  - ✅ "5 Models, One Answer: The AxCouncil Approach"
  - ❌ "You Won't BELIEVE What These AIs Decided!"

### Paragraphs
- Maximum 3 sentences per paragraph
- One idea per paragraph
- Use short sentences for impact

### Structure
- Always start with the key insight (inverted pyramid)
- Use subheadings every 200-300 words
- Include bullet points for scanability
- End with a clear call-to-action

## Terminology

### Always Use:
- "AI council" (not "AI committee" or "AI panel")
- "deliberation" (not "discussion" or "debate")
- "synthesis" (not "summary" or "conclusion")
- "flagship models" (not "best models" or "top models")

### Never Use:
- "Revolutionary" or "game-changing" (overused)
- "Synergy" (corporate speak)
- "Leverage" as a verb (use "use" instead)
- "Utilize" (use "use" instead)

## Formatting

### Blog Posts
- Hero image: Required (16:9 ratio)
- Word count: 1200-2000 words
- Reading time: Display at top
- Author byline: Required
- Last updated: Display if edited

### Social Media

#### LinkedIn
- Length: 300-500 words
- Hashtags: 3-5, at end
- Emoji: Minimal (1-2 max)
- Format: Short paragraphs, line breaks

#### Twitter/X
- Thread length: 5-7 tweets
- First tweet: Hook (no hashtags)
- Last tweet: CTA + link + hashtags
- Emoji: Optional but consistent

## Visual Guidelines

### Image Style
- Clean, minimal, tech-forward
- Primary colors: Deep blue, purple gradients
- No stock photos with fake smiles
- Abstract/geometric preferred over literal

### Image Prompts Should Include:
- "clean white or dark background"
- "professional corporate aesthetic"
- "no text unless specifically required"
- "subtle blue and purple gradients"
- "minimalist tech illustration style"

## Content Types

### For Each Type, Council Should:

| Type | Focus | Tone | CTA |
|------|-------|------|-----|
| Blog Post | Education | Informative | Read more / Try it |
| Feature Page | Benefits | Persuasive | Start free trial |
| Case Study | Results | Credible | Contact sales |
| LinkedIn | Insights | Professional | Engage / Share |
| Twitter | Hooks | Punchy | Click / Follow |

## Quality Checklist

Before publishing, every piece must:
- [ ] Follow voice guidelines
- [ ] Have proper formatting
- [ ] Include relevant CTA
- [ ] Be factually accurate (check citations)
- [ ] Have meta title < 60 chars
- [ ] Have meta description < 160 chars
- [ ] Include hero image
- [ ] Be proofread for typos
```

### How Council Uses the Playbook

```typescript
// When generating content, include playbook in system prompt
const systemPrompt = `
You are part of the AxCouncil content creation team.
You must follow the Brand Playbook guidelines strictly.

${brandPlaybook}

Based on these guidelines, create content for the following brief.
Ensure your output matches our voice, follows our formatting rules,
and uses our approved terminology.
`;
```

---

## Content Templates

### Blog Post Template

```json
{
  "name": "Standard Blog Post",
  "type": "blog",
  "structure": {
    "sections": [
      {
        "name": "title",
        "type": "text",
        "required": true,
        "guidelines": "Max 60 characters, keyword-forward"
      },
      {
        "name": "subtitle",
        "type": "text",
        "required": false,
        "guidelines": "Optional clarifying line"
      },
      {
        "name": "hero_image_prompt",
        "type": "text",
        "required": true,
        "guidelines": "Detailed prompt for AI image generation"
      },
      {
        "name": "introduction",
        "type": "markdown",
        "required": true,
        "min_words": 50,
        "max_words": 150,
        "guidelines": "Hook + key insight + what reader will learn"
      },
      {
        "name": "main_sections",
        "type": "markdown",
        "required": true,
        "min_words": 800,
        "max_words": 1500,
        "guidelines": "H2 headings, short paragraphs, bullet points"
      },
      {
        "name": "key_takeaways",
        "type": "list",
        "required": true,
        "min_items": 3,
        "max_items": 5,
        "guidelines": "Actionable insights, one sentence each"
      },
      {
        "name": "conclusion",
        "type": "markdown",
        "required": true,
        "max_words": 150,
        "guidelines": "Summary + CTA"
      },
      {
        "name": "meta_title",
        "type": "text",
        "required": true,
        "max_chars": 60,
        "guidelines": "SEO-optimized, includes primary keyword"
      },
      {
        "name": "meta_description",
        "type": "text",
        "required": true,
        "max_chars": 160,
        "guidelines": "Compelling summary with CTA"
      }
    ]
  }
}
```

### Feature Page Template

```json
{
  "name": "Feature Page",
  "type": "feature_page",
  "structure": {
    "sections": [
      {
        "name": "hero_headline",
        "type": "text",
        "required": true,
        "max_words": 8,
        "guidelines": "Benefit-focused, action-oriented"
      },
      {
        "name": "hero_subheadline",
        "type": "text",
        "required": true,
        "max_words": 20,
        "guidelines": "Clarify the value proposition"
      },
      {
        "name": "problem_statement",
        "type": "markdown",
        "required": true,
        "max_words": 100,
        "guidelines": "What pain point does this solve?"
      },
      {
        "name": "solution_overview",
        "type": "markdown",
        "required": true,
        "max_words": 150,
        "guidelines": "How we solve it"
      },
      {
        "name": "how_it_works",
        "type": "list",
        "required": true,
        "items": 3,
        "guidelines": "Three steps to success"
      },
      {
        "name": "benefits",
        "type": "list",
        "required": true,
        "min_items": 3,
        "max_items": 6,
        "guidelines": "Tangible benefits with metrics if possible"
      },
      {
        "name": "social_proof",
        "type": "markdown",
        "required": false,
        "guidelines": "Testimonial or stat"
      },
      {
        "name": "cta",
        "type": "text",
        "required": true,
        "guidelines": "Clear call-to-action"
      }
    ]
  }
}
```

### LinkedIn Post Template

```json
{
  "name": "LinkedIn Post",
  "type": "linkedin",
  "structure": {
    "sections": [
      {
        "name": "hook",
        "type": "text",
        "required": true,
        "max_words": 15,
        "guidelines": "Attention-grabbing first line"
      },
      {
        "name": "body",
        "type": "text",
        "required": true,
        "min_words": 150,
        "max_words": 400,
        "guidelines": "Short paragraphs, line breaks between"
      },
      {
        "name": "cta",
        "type": "text",
        "required": true,
        "max_words": 20,
        "guidelines": "Engagement prompt or link CTA"
      },
      {
        "name": "hashtags",
        "type": "list",
        "required": true,
        "items": 4,
        "guidelines": "Relevant, not overly generic"
      }
    ]
  }
}
```

### Twitter Thread Template

```json
{
  "name": "Twitter Thread",
  "type": "twitter_thread",
  "structure": {
    "sections": [
      {
        "name": "hook_tweet",
        "type": "text",
        "required": true,
        "max_chars": 280,
        "guidelines": "Hook only, no hashtags, creates curiosity"
      },
      {
        "name": "body_tweets",
        "type": "array",
        "required": true,
        "min_items": 4,
        "max_items": 6,
        "item_max_chars": 280,
        "guidelines": "One key insight per tweet, numbered"
      },
      {
        "name": "closing_tweet",
        "type": "text",
        "required": true,
        "max_chars": 280,
        "guidelines": "Summary + CTA + link + hashtags"
      }
    ]
  }
}
```

---

## SEO & AEO Integration

### Auto-Generated SEO Elements

For every content piece, the council generates:

| Element | Source | Character Limit |
|---------|--------|-----------------|
| **Meta Title** | Council generates | 60 chars |
| **Meta Description** | Council generates | 160 chars |
| **URL Slug** | Auto from title | 60 chars |
| **OG Title** | Same as meta or custom | 60 chars |
| **OG Description** | Same as meta or custom | 200 chars |
| **OG Image** | Auto-generated | 1200x630 |
| **Twitter Title** | Same as OG | 70 chars |
| **Twitter Description** | Same as OG | 200 chars |

### Structured Data Auto-Generation

```typescript
// Auto-generate Article schema for blog posts
function generateArticleSchema(content: ContentItem): ArticleSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": content.title,
    "description": content.meta_description,
    "image": content.hero_image?.url,
    "author": {
      "@type": "Organization",
      "name": "AxCouncil"
    },
    "publisher": {
      "@type": "Organization",
      "name": "AxCouncil",
      "logo": "https://axcouncil.ai/favicon.svg"
    },
    "datePublished": content.published_at,
    "dateModified": content.updated_at,
    "mainEntityOfPage": `https://axcouncil.ai/blog/${content.slug}`
  };
}
```

### Sitemap Auto-Update

When content is published:
1. Add URL to sitemap.xml
2. Ping Google/Bing (optional)
3. Update llms.txt if significant

```typescript
// n8n workflow or backend function
async function updateSitemap(content: ContentItem) {
  const sitemapEntry = {
    loc: `https://axcouncil.ai/blog/${content.slug}`,
    lastmod: content.published_at,
    changefreq: 'monthly',
    priority: 0.7
  };

  await addToSitemap(sitemapEntry);
  await pingSearchEngines(); // Optional
}
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

**Goal**: Basic content creation and storage

| Task | Effort | Priority |
|------|--------|----------|
| Database schema (content_items, versions) | 2 days | P0 |
| Content Editor UI in MyCompany | 5 days | P0 |
| "Generate with Council" button | 3 days | P0 |
| Brand Playbook integration | 2 days | P0 |
| Basic templates (blog, feature) | 2 days | P0 |
| Draft/Publish workflow | 2 days | P0 |
| Version history | 1 day | P1 |

**Deliverable**: Can create and edit content, generate with council, save to database.

### Phase 2: Research & Media (Weeks 5-8)

**Goal**: Perplexity integration and image generation

| Task | Effort | Priority |
|------|--------|----------|
| Perplexity API integration | 3 days | P0 |
| Research UI (query, results, approve) | 3 days | P0 |
| n8n setup (self-hosted) | 1 day | P0 |
| Flux Pro integration (via n8n) | 2 days | P0 |
| Ideogram integration | 1 day | P1 |
| OG image template generator | 2 days | P1 |
| Media asset management UI | 3 days | P0 |

**Deliverable**: Can research topics, generate images, attach to content.

### Phase 3: Publishing (Weeks 9-12)

**Goal**: Public website and social publishing

| Task | Effort | Priority |
|------|--------|----------|
| Public /blog route (SSG) | 3 days | P0 |
| Blog list page | 2 days | P0 |
| Blog article page | 3 days | P0 |
| Auto sitemap update | 1 day | P0 |
| LinkedIn API integration | 2 days | P0 |
| Twitter API integration | 2 days | P0 |
| Social post scheduling | 2 days | P1 |
| Multi-platform output UI | 3 days | P0 |

**Deliverable**: Can publish blog posts, auto-post to social media.

### Phase 4: Advanced Features (Weeks 13-16)

**Goal**: Video, analytics, and polish

| Task | Effort | Priority |
|------|--------|----------|
| Kling video integration | 3 days | P1 |
| Runway integration | 2 days | P2 |
| Contact form (Formspree) | 1 day | P0 |
| Newsletter integration | 2 days | P1 |
| Analytics collection | 3 days | P1 |
| Analytics dashboard | 3 days | P2 |
| Content calendar view | 2 days | P2 |
| A/B testing for headlines | 3 days | P2 |

**Deliverable**: Full content studio with video, analytics, and automation.

### Phase 5: Marketing Pages (Weeks 17-18)

**Goal**: Core website pages using the system

| Task | Effort | Priority |
|------|--------|----------|
| /features page | 1 day | P0 |
| /pricing page | 1 day | P0 |
| /about page | 1 day | P0 |
| /contact page | 0.5 day | P0 |
| /privacy page | 0.5 day | P0 |
| /terms page | 0.5 day | P0 |
| Update sitemap | 0.5 day | P0 |
| Update llms.txt | 0.5 day | P0 |

**Deliverable**: Complete marketing website, all generated by council.

---

## Cost Analysis

### Per Content Piece

| Component | Provider | Cost |
|-----------|----------|------|
| Research | Perplexity Sonar Pro | $0.005 |
| Council (5 models) | OpenRouter | $0.50-1.00 |
| Hero image | Flux Pro | $0.05 |
| Social cards (3) | Ideogram | $0.24 |
| OG image | Template | Free |
| **Subtotal (no video)** | | **$0.80-1.30** |
| Video (15 sec) | Kling | $4.50 |
| **Subtotal (with video)** | | **$5.30-5.80** |

### Monthly Estimates

| Volume | Without Video | With Video |
|--------|---------------|------------|
| 10 articles/mo | $8-13 | $53-58 |
| 50 articles/mo | $40-65 | $265-290 |
| 100 articles/mo | $80-130 | $530-580 |

### Infrastructure Costs

| Service | Cost/Month | Notes |
|---------|------------|-------|
| n8n (self-hosted) | $0-20 | VPS or existing infra |
| Supabase | Existing | Already using |
| Vercel/Netlify | $0-20 | For SSG hosting |
| **Total infra** | **$0-40/mo** | |

### ROI Analysis

| Metric | Value |
|--------|-------|
| Content agency cost (10 articles) | $2,000-5,000/mo |
| AxCouncil cost (10 articles) | $8-58/mo |
| **Savings** | **$1,942-4,992/mo** |
| Time saved per article | 3-4 hours |
| Time saved monthly (10 articles) | 30-40 hours |

---

## The Moat

### Why This Is Worth $25M

| Asset | Defensibility |
|-------|---------------|
| **Multi-model orchestration** | Proprietary - no one else has 5 models debating |
| **Content Studio** | Integrated - council generates, publishes, tracks |
| **Brand Playbook system** | Stickiness - users invest in training the system |
| **Research + Council** | Unique - real-time data + multi-model synthesis |
| **Full automation** | Value - brief to published with one click |
| **Self-hosted stack** | Control - no vendor dependency |

### Switching Costs

Once a company has:
- Brand playbook configured
- Templates customized
- Content library built
- Analytics historical data
- Team trained on workflow

**They're not switching.** That's the moat.

### Competitive Landscape

| Competitor | What They Do | What We Do Better |
|------------|--------------|-------------------|
| Jasper | Single model content | 5 models debate quality |
| Copy.ai | Templates + AI | Research + Council + Templates |
| Buffer | Social scheduling | Generate + Schedule |
| WordPress | CMS | AI-native CMS |
| ChatGPT | Q&A | Structured content workflow |

### The Story That Sells

> "AxCouncil isn't just another AI writing tool.
> It's the only platform where five of the world's best AI models -
> Claude Opus, GPT-5.1, Gemini 3, Grok 4, and DeepSeek V3 -
> debate and collaborate on every piece of content.
>
> Our own blog? Written by our council.
> Our social media? Debated by five perspectives.
> Our marketing? AI-powered, human-approved.
>
> This is what AI collaboration looks like."

---

## Appendix: API Reference

### Perplexity API

```bash
POST https://api.perplexity.ai/chat/completions
Authorization: Bearer $PERPLEXITY_API_KEY

{
  "model": "sonar-pro",
  "messages": [{"role": "user", "content": "..."}],
  "search_recency_filter": "week",
  "return_citations": true
}
```

### Flux Pro (via Replicate)

```bash
POST https://api.replicate.com/v1/predictions
Authorization: Token $REPLICATE_API_TOKEN

{
  "model": "black-forest-labs/flux-pro",
  "input": {
    "prompt": "...",
    "aspect_ratio": "16:9"
  }
}
```

### LinkedIn API

```bash
POST https://api.linkedin.com/v2/ugcPosts
Authorization: Bearer $LINKEDIN_ACCESS_TOKEN

{
  "author": "urn:li:organization:COMPANY_ID",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": {"text": "..."},
      "shareMediaCategory": "NONE"
    }
  },
  "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
}
```

### Twitter/X API v2

```bash
POST https://api.twitter.com/2/tweets
Authorization: Bearer $TWITTER_BEARER_TOKEN

{
  "text": "Tweet content here"
}
```

### Kling API

```bash
POST https://api.klingai.com/v1/videos/text2video
Authorization: Bearer $KLING_API_KEY

{
  "prompt": "...",
  "duration": 5,
  "aspect_ratio": "16:9"
}
```

---

## Appendix: File Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── content-studio/
│   │       ├── ContentEditor.tsx
│   │       ├── ContentList.tsx
│   │       ├── ResearchPanel.tsx
│   │       ├── MediaLibrary.tsx
│   │       ├── SocialPreview.tsx
│   │       ├── PublishWorkflow.tsx
│   │       └── TemplateSelector.tsx
│   ├── hooks/
│   │   ├── useContentGeneration.ts
│   │   ├── usePerplexityResearch.ts
│   │   └── useMediaGeneration.ts
│   └── pages/
│       └── blog/
│           ├── index.tsx (list)
│           └── [slug].tsx (article)
│
backend/
├── routers/
│   └── content/
│       ├── content.py
│       ├── research.py
│       ├── media.py
│       └── social.py
│
n8n/
├── workflows/
│   ├── content-publishing.json
│   ├── image-generation.json
│   ├── video-generation.json
│   └── social-posting.json
│
supabase/
└── migrations/
    └── 20260120_content_studio.sql
```

---

## Next Steps

1. **Review this document** - Ensure alignment on vision
2. **Prioritize Phase 1** - Start with content foundation
3. **Set up n8n** - Self-host for automation
4. **Create Brand Playbook** - The content council will follow
5. **Build incrementally** - Ship each phase, then iterate

---

*Document created: January 20, 2026*
*Last updated: January 20, 2026*
*Version: 1.0*
