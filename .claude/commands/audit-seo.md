# AI Search Optimization Audit - SEO, AEO & GEO for 2026

You are a search optimization specialist auditing a SaaS platform for visibility across traditional search engines AND AI-powered answer engines. This audit ensures the product is discoverable via Google, Bing, ChatGPT, Perplexity, Claude, Gemini, and AI Overviews.

**The 2026 Reality**: Traditional search volume is declining 25% (Gartner). 80% of searchers now rely on "zero-click" results. AI Overviews appear in 18-21% of Google searches. You need a hybrid SEO + AEO + GEO strategy.

## The New Search Trilogy: SEO, AEO, GEO

```
SEO (Search Engine Optimization):
├── Goal: Rank in traditional search results
├── Targets: Google, Bing SERPs
├── Metrics: Rankings, CTR, organic traffic
└── Focus: Keywords, backlinks, technical health

AEO (Answer Engine Optimization):
├── Goal: Be cited/featured in AI-generated answers
├── Targets: ChatGPT, Perplexity, Google AI Overview, Bing Copilot
├── Metrics: AI citations, brand mentions in answers
└── Focus: Clear Q&A format, structured data, definitive answers

GEO (Generative Engine Optimization):
├── Goal: Be trusted source material for AI training/responses
├── Targets: LLM training data, RAG retrieval systems
├── Metrics: Authority signals, E-E-A-T, content citations
└── Focus: Authoritative content, entity clarity, trust signals
```

**Microsoft's 2026 AEO/GEO guidance**: "If SEO focused on driving clicks, AEO is focused on driving clarity with enriched, real-time data. GEO helps establish credibility through authoritative voice."

## Audit Checklist

### 1. Core Web Vitals 2.0 (2026 Standards)

```
Performance Metrics (Updated 2026):
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] INP (Interaction to Next Paint) < 200ms  ← REPLACES FID
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] VSI (Visual Stability Index) - NEW 2026 metric
- [ ] TTFB (Time to First Byte) < 600ms

Why INP Matters:
- FID only measured FIRST interaction delay
- INP measures ALL interactions throughout page lifecycle
- INP includes full time until visual response appears
- Especially important for SPAs and complex React apps

Measurement:
- [ ] PageSpeed Insights score > 90
- [ ] Core Web Vitals in Google Search Console
- [ ] Real User Metrics tracked (web-vitals library)
- [ ] Performance budget defined and monitored
- [ ] Lighthouse CI in deployment pipeline
```

**Files to Review:**
- `frontend/vite.config.js` - Build optimization, code splitting
- `frontend/index.html` - Critical resource loading, preloads
- `frontend/src/main.tsx` - Initial render performance

### 2. AI Crawler Control (llms.txt + robots.txt)

```
Traditional Crawlers (robots.txt):
- [ ] robots.txt blocks staging, admin, filter URLs
- [ ] Crawl budget optimized (no infinite pagination)
- [ ] Sitemap linked in robots.txt

AI Crawlers (llms.txt) - NEW 2026:
- [ ] llms.txt at domain root (yoursite.com/llms.txt)
- [ ] Curated 20-50 most important URLs
- [ ] Content usage policies defined
- [ ] Citation/summarization permissions specified

Known AI Crawlers to Consider:
- GPTBot (OpenAI/ChatGPT)
- Google-Extended (Gemini/AI Overview)
- ClaudeBot (Anthropic)
- PerplexityBot
- Bytespider (TikTok)

llms.txt Best Practices:
- Keep it short: 20-50 links max (curation, not dumping)
- Include: Key landing pages, docs, pricing, features
- Exclude: Dynamic app URLs, user-generated content
- Update monthly as content changes
```

**Example llms.txt:**
```
# AxCouncil - AI Decision Platform
# https://axcouncil.com/llms.txt

## Primary Pages
- https://axcouncil.com/ (Homepage - AI decision council overview)
- https://axcouncil.com/features (Product capabilities)
- https://axcouncil.com/pricing (Plans and pricing)
- https://axcouncil.com/how-it-works (3-stage deliberation process)

## Documentation
- https://axcouncil.com/docs (Getting started guide)
- https://axcouncil.com/docs/api (API reference)

## Content Policies
- Summarization: Allowed with attribution
- Training: Allowed
- Citation: Required for direct quotes
```

**Files to Create/Review:**
- `frontend/public/robots.txt`
- `frontend/public/llms.txt` - NEW
- `frontend/public/sitemap.xml`

### 3. AEO: Answer Engine Optimization

```
Content Structure for AI Citations:
- [ ] Definitive answers in 40-60 word sweet spot
- [ ] Question words in headings (who, what, when, where, why, how)
- [ ] FAQ sections with clear Q&A pairs
- [ ] Summary paragraphs at article beginnings
- [ ] Bulleted lists for multi-step processes

Entity Clarity (Helps AI understand your content):
- [ ] Brand name used consistently
- [ ] Product features explicitly named
- [ ] Technical terms defined on first use
- [ ] Author/expert credentials visible (E-E-A-T)

AI-Friendly Formats:
- [ ] Data tables for comparisons
- [ ] Bullet points for feature lists
- [ ] Numbered lists for processes
- [ ] Code blocks for technical content
- [ ] Definitions in bold: **Term**: Description pattern

Content Types That Get AI Citations:
- [ ] Ultimate guides (comprehensive single-topic resources)
- [ ] Comparison tables (explicit, scannable differences)
- [ ] Statistics pages (centralized data points)
- [ ] Glossaries (clear, consistent definitions)
- [ ] How-to tutorials (step-by-step instructions)
```

### 4. Technical SEO Fundamentals (Still Critical in 2026)

```
Crawlability:
- [ ] robots.txt configured correctly
- [ ] XML sitemap exists, valid, and submitted
- [ ] No blocked critical resources in robots.txt
- [ ] JavaScript rendering handled (SSR/SSG/ISR or proper CSR)
- [ ] No orphan pages (all pages linked internally)

Indexability:
- [ ] Pages return 200 status
- [ ] No accidental noindex meta tags
- [ ] Canonical URLs set correctly on all pages
- [ ] Hreflang for internationalization (if applicable)
- [ ] Mobile-first indexable (Google uses mobile-first)

URL Structure:
- [ ] Clean, readable URLs (no ?id=12345&session=abc)
- [ ] Logical hierarchy (/features/ai-council/)
- [ ] No duplicate content across URLs
- [ ] 301 redirects for changed URLs
- [ ] HTTPS everywhere (no mixed content)

SPA-Specific (React/Vue/Angular):
- [ ] History API routing (not hash fragments)
- [ ] Browser back/forward buttons work correctly
- [ ] Deep links load correct content
- [ ] Social media crawlers can read content
- [ ] Prerendering for static pages (optional but recommended)
```

### 5. Structured Data Schema (Enhanced for AI)

```
Essential Schema Types:
- [ ] Organization - Homepage
- [ ] WebSite + SearchAction - Site-wide search
- [ ] SoftwareApplication - Product pages
- [ ] Product with Offers - Pricing pages
- [ ] FAQPage - FAQ sections
- [ ] HowTo - Tutorials/guides
- [ ] Article/BlogPosting - Content pages
- [ ] BreadcrumbList - Navigation hierarchy
- [ ] Person (Author) - For E-E-A-T signals

2026 Schema Best Practices:
- [ ] JSON-LD format (not microdata or RDFa)
- [ ] Schema validates in Rich Results Test
- [ ] No spam/deceptive markup
- [ ] Schema matches visible page content
- [ ] Updated when content changes

AI-Specific Schema (Emerging):
- [ ] speakable property for voice search
- [ ] mentions for entity linking
- [ ] author credentials for trust
```

**Enhanced Schema Example:**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "AxCouncil",
  "description": "AI-powered decision council that orchestrates multiple LLM models (Claude, GPT, Gemini) through a 3-stage deliberation pipeline for better business decisions.",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "priceValidUntil": "2026-12-31"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "127"
  },
  "author": {
    "@type": "Organization",
    "name": "AxCouncil",
    "url": "https://axcouncil.com"
  }
}
</script>
```

### 6. On-Page SEO + AEO Hybrid

```
Meta Tags (Traditional SEO):
- [ ] Unique title tags < 60 chars, keyword-forward
- [ ] Unique meta descriptions < 160 chars with CTA
- [ ] No duplicate titles/descriptions across site

Heading Structure:
- [ ] One H1 per page with primary keyword
- [ ] H1 answers "What is this page about?"
- [ ] Logical H1 → H2 → H3 hierarchy
- [ ] H2s can be questions (AEO benefit)

Content Optimization:
- [ ] First paragraph answers main query (Position 0)
- [ ] Keywords naturally integrated (no stuffing)
- [ ] Alt text on all images (descriptive, not keyword-stuffed)
- [ ] Internal links with descriptive anchor text
- [ ] External links to authoritative sources (builds trust)

AEO-Specific Content:
- [ ] "What is [Product]?" section on homepage
- [ ] "How does [Feature] work?" on feature pages
- [ ] Direct answers to common questions
- [ ] Comparison content: "[Product] vs [Competitor]"
```

### 7. Social Media & Open Graph

```
Open Graph (Facebook/LinkedIn):
- [ ] og:title (different from page title, more engaging)
- [ ] og:description (social-optimized, may include emoji)
- [ ] og:image (1200x630px, branded)
- [ ] og:url (canonical)
- [ ] og:type (website/article/product)
- [ ] og:site_name

Twitter/X Cards:
- [ ] twitter:card (summary_large_image preferred)
- [ ] twitter:title
- [ ] twitter:description
- [ ] twitter:image
- [ ] twitter:site (@handle)

Validation:
- [ ] Facebook Sharing Debugger
- [ ] Twitter Card Validator
- [ ] LinkedIn Post Inspector
- [ ] Test actual share on each platform
```

### 8. Mobile Experience (Critical for AI Search)

```
Mobile Optimization:
- [ ] Responsive design (no separate m.domain)
- [ ] Mobile viewport meta tag present
- [ ] Touch targets 44px+ minimum
- [ ] No horizontal scroll
- [ ] Readable without zoom (16px+ base font)
- [ ] Mobile page speed optimized

Mobile Navigation (SPA-Specific):
- [ ] Browser back button works as expected
- [ ] Swipe gestures don't interfere with navigation
- [ ] Deep links work on mobile
- [ ] No "stuck" states requiring app reload

Testing:
- [ ] Chrome DevTools mobile emulation
- [ ] Real device testing (iOS Safari, Android Chrome)
- [ ] Google Mobile-Friendly Test
- [ ] Test slow 3G connection
```

### 9. E-E-A-T Signals (Experience, Expertise, Authority, Trust)

```
Experience:
- [ ] First-hand experience demonstrated in content
- [ ] Case studies with real examples
- [ ] User testimonials/reviews visible

Expertise:
- [ ] Author bylines on content
- [ ] Author credentials/bio pages
- [ ] Technical accuracy in content
- [ ] Citations to authoritative sources

Authority:
- [ ] Backlinks from relevant, trusted sites
- [ ] Mentions in industry publications
- [ ] Social proof (logos, testimonials)
- [ ] Domain age and history

Trust:
- [ ] HTTPS everywhere
- [ ] Clear contact information
- [ ] Privacy policy accessible
- [ ] Terms of service accessible
- [ ] Physical address (if applicable)
- [ ] Security certifications (SOC 2, etc.)
```

### 10. AI Traffic Measurement (New KPIs)

```
Traditional SEO KPIs:
- [ ] Google Search Console configured
- [ ] Organic traffic tracked in GA4
- [ ] Keyword rankings monitored
- [ ] Click-through rates tracked

AI/AEO KPIs (2026):
- [ ] ChatGPT referral traffic (analytics shows chatgpt.com)
- [ ] Perplexity referral traffic
- [ ] AI citations monitored (manual or tool-based)
- [ ] Brand mentions in AI responses tracked
- [ ] "Zero-click" visibility measured

Tools for AI Visibility:
- [ ] Track chatgpt.com/perplexity.ai in referral sources
- [ ] Set up brand mention alerts
- [ ] Manual testing: Ask AI "What is [Your Product]?"
- [ ] Monitor AI Overview inclusion for target queries
```

### 11. Link Health & Internal Linking

```
Internal Links:
- [ ] No broken internal links (404s)
- [ ] Descriptive anchor text (not "click here")
- [ ] Important pages within 3 clicks of home
- [ ] Breadcrumb navigation implemented
- [ ] Related content links on each page
- [ ] Navigation links crawlable (not JS-only)

External Links:
- [ ] No broken outbound links
- [ ] rel="noopener noreferrer" on external links
- [ ] rel="nofollow" on user-generated content
- [ ] Links to authoritative sources (builds trust)
```

### 12. Content Strategy for AI Visibility

```
Content Types That Win in AI Search:
- [ ] Comprehensive guides (2000+ words, covers full topic)
- [ ] FAQ pages with real customer questions
- [ ] Glossary/terminology pages
- [ ] Comparison content (vs competitors, vs alternatives)
- [ ] How-to tutorials with numbered steps
- [ ] Statistics/research pages with cited data

Content Updates:
- [ ] Regular content freshness updates
- [ ] "Last updated" dates visible
- [ ] Outdated content archived or updated
- [ ] New content aligned with AI search trends
```

## Output Format

### Overall Scores

| Category | Score (1-10) | Notes |
|----------|--------------|-------|
| Technical SEO Foundation | | |
| Core Web Vitals 2.0 | | |
| AEO (Answer Engine) | | |
| GEO (Generative Engine) | | |
| Mobile Experience | | |
| E-E-A-T Signals | | |

### Core Web Vitals Report

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| LCP | | < 2.5s | |
| INP | | < 200ms | |
| CLS | | < 0.1 | |
| TTFB | | < 600ms | |
| PageSpeed Score | | > 90 | |

### AI Visibility Status

| Platform | Visibility | Notes |
|----------|------------|-------|
| Google AI Overview | | |
| ChatGPT/Browse | | |
| Perplexity | | |
| Bing Copilot | | |

### Critical Issues (Must Fix)

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|

### High Priority (Should Fix)

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|

### Medium Priority (Nice to Have)

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|

### Implementation Roadmap

| Phase | Focus | Expected Impact |
|-------|-------|-----------------|
| 1. Technical Foundation | Core Web Vitals, robots.txt, sitemap | Crawlable + Fast |
| 2. AI Optimization | llms.txt, structured data, FAQ content | AI-Citable |
| 3. Content Enhancement | E-E-A-T signals, comprehensive guides | Authoritative |
| 4. Measurement | AI traffic tracking, citation monitoring | Data-Driven |

### Quick Wins (< 1 day effort)

| Action | Effort | Impact |
|--------|--------|--------|
| Add llms.txt file | 1 hour | AI Visibility |
| Add FAQ schema | 2 hours | Rich Results + AEO |
| Fix INP issues | 2-4 hours | Core Web Vitals |
| Add author bylines | 1 hour | E-E-A-T |

---

## Key Sources

This audit is based on 2026 best practices from:
- [The Complete Guide to SEO vs AEO vs GEO](https://www.ladybugz.com/seo-aeo-geo-guide-2026/)
- [2026 AEO/GEO Benchmarks Report - Conductor](https://www.conductor.com/academy/aeo-geo-benchmarks-report/)
- [Enterprise SEO and AI Trends for 2026 - Search Engine Journal](https://www.searchenginejournal.com/key-enterprise-seo-and-ai-trends-for-2026/558508/)
- [Core Web Vitals 2026 - Technical SEO Guide](https://almcorp.com/blog/core-web-vitals-2026-technical-seo-guide/)
- [llms.txt vs robots.txt Guide](https://www.spoclearn.com/blog/llms-txt-vs-robots-txt-2026-ai-search/)

**Remember**: AI search is not replacing traditional SEO—it's adding a new layer. The brands appearing in AI answers in 2026 will be those with strong technical foundations, authoritative content, and clear entity signals. Technical SEO remains the prerequisite for AI visibility.
