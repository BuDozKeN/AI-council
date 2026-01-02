# SEO & Marketing Technical Audit - Organic Growth Engine

You are a technical SEO specialist auditing a SaaS platform for search engine optimization and marketing technical requirements. This audit ensures the product can be discovered organically and supports marketing efforts.

**The Stakes**: Organic search is the cheapest customer acquisition channel. Good SEO = lower CAC = higher margins = higher valuation. Technical SEO issues can completely block organic traffic.

## SEO Priority for SaaS

```
SEO Value by Page Type:

High Value:
├── Landing page (product positioning)
├── Feature pages (feature discovery)
├── Pricing page (bottom of funnel)
├── Blog/content (top of funnel)
└── Documentation (developer discovery)

Medium Value:
├── About/team pages (trust)
├── Case studies (social proof)
└── Integrations pages

Low Value (Often No-Index):
├── App dashboard (authenticated)
├── Settings pages
└── Internal tools
```

## Audit Checklist

### 1. Core Web Vitals

```
Performance Metrics:
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] FID (First Input Delay) < 100ms
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] TTFB (Time to First Byte) < 600ms
- [ ] TTI (Time to Interactive) < 3.8s

Measurement:
- [ ] PageSpeed Insights score > 90
- [ ] Core Web Vitals in Google Search Console
- [ ] Real User Metrics tracked (web-vitals)
- [ ] Performance budget defined
```

**Files to Review:**
- `frontend/vite.config.js` - Build optimization
- `frontend/index.html` - Critical resources

### 2. Technical SEO Fundamentals

```
Crawlability:
- [ ] robots.txt configured correctly
- [ ] XML sitemap exists and valid
- [ ] Sitemap submitted to Search Console
- [ ] No blocked critical resources
- [ ] JavaScript rendering handled

Indexability:
- [ ] Pages return 200 status
- [ ] No accidental noindex tags
- [ ] Canonical URLs set correctly
- [ ] Hreflang for internationalization
- [ ] Mobile-first indexable

URL Structure:
- [ ] Clean, readable URLs
- [ ] No dynamic parameters in indexed URLs
- [ ] Proper URL hierarchy
- [ ] No duplicate URLs
- [ ] 301 redirects for changed URLs
```

**Files to Review/Create:**
- `frontend/public/robots.txt`
- `frontend/public/sitemap.xml`
- URL structure patterns

### 3. On-Page SEO

```
Meta Tags:
- [ ] Unique title tags (< 60 chars)
- [ ] Unique meta descriptions (< 160 chars)
- [ ] Title includes primary keyword
- [ ] Meta description includes CTA
- [ ] No duplicate titles/descriptions

Heading Structure:
- [ ] One H1 per page
- [ ] H1 includes primary keyword
- [ ] Logical heading hierarchy (H1→H2→H3)
- [ ] Headings are descriptive

Content:
- [ ] Sufficient content on key pages
- [ ] Keywords naturally integrated
- [ ] Alt text on all images
- [ ] Internal linking strategy
- [ ] External links where appropriate
```

### 4. Structured Data

```
Schema.org Implementation:
- [ ] Organization schema on homepage
- [ ] Product schema on product pages
- [ ] FAQ schema where applicable
- [ ] HowTo schema for tutorials
- [ ] Article schema for blog posts
- [ ] BreadcrumbList for navigation
- [ ] Software Application schema

Validation:
- [ ] Schema validated (Google Rich Results Test)
- [ ] No errors in schema
- [ ] Schema matches page content
- [ ] JSON-LD format used
```

**Schema Example:**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "AxCouncil",
  "description": "AI-powered decision council platform",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
</script>
```

### 5. Social Media Meta Tags

```
Open Graph (Facebook/LinkedIn):
- [ ] og:title
- [ ] og:description
- [ ] og:image (1200x630px)
- [ ] og:url
- [ ] og:type
- [ ] og:site_name

Twitter Cards:
- [ ] twitter:card
- [ ] twitter:title
- [ ] twitter:description
- [ ] twitter:image
- [ ] twitter:site

Validation:
- [ ] Facebook Debugger test
- [ ] Twitter Card Validator test
- [ ] LinkedIn Post Inspector test
```

**Files to Review:**
- `frontend/index.html` - Meta tags
- OG image assets

### 6. Mobile SEO

```
Mobile Optimization:
- [ ] Responsive design
- [ ] Mobile viewport meta tag
- [ ] Touch-friendly targets (44px+)
- [ ] No horizontal scroll
- [ ] Readable without zoom
- [ ] Mobile page speed optimized

Mobile Testing:
- [ ] Google Mobile-Friendly Test pass
- [ ] Chrome DevTools mobile audit
- [ ] Real device testing
```

### 7. International SEO (if applicable)

```
Multi-Language:
- [ ] hreflang tags implemented
- [ ] x-default specified
- [ ] Language in URL (/en/, /es/)
- [ ] Localized content (not just translated)
- [ ] Localized meta tags

Regional Targeting:
- [ ] Google Search Console geo-targeting
- [ ] Local hosting/CDN considerations
- [ ] Currency/pricing localization
```

### 8. Security & Trust Signals

```
Security:
- [ ] HTTPS everywhere
- [ ] Valid SSL certificate
- [ ] No mixed content
- [ ] HSTS header

Trust:
- [ ] Privacy Policy accessible
- [ ] Terms of Service accessible
- [ ] Contact information visible
- [ ] Physical address (for local SEO)
- [ ] Trust badges (SOC 2, etc.)
```

### 9. Link Health

```
Internal Links:
- [ ] No broken internal links
- [ ] Proper anchor text
- [ ] Navigation links crawlable
- [ ] Deep linking to important pages
- [ ] Breadcrumb navigation

External Links:
- [ ] No broken outbound links
- [ ] rel="noopener" for external links
- [ ] Appropriate rel="nofollow" usage
```

### 10. Analytics & Search Console

```
Tracking Setup:
- [ ] Google Analytics 4 configured
- [ ] Google Search Console verified
- [ ] Bing Webmaster Tools (optional)
- [ ] Site ownership verified
- [ ] Property properly configured

Data Collection:
- [ ] Search queries visible
- [ ] Click-through rates tracked
- [ ] Index coverage monitored
- [ ] Core Web Vitals monitored
- [ ] Manual actions checked
```

### 11. Content Marketing Technical Requirements

```
Blog/Content Platform:
- [ ] Blog exists and is indexable
- [ ] Blog on main domain (not subdomain)
- [ ] Category/tag pages optimized
- [ ] Author pages (E-E-A-T)
- [ ] Publication dates visible
- [ ] Social sharing buttons

Content Features:
- [ ] RSS feed available
- [ ] Email signup integration
- [ ] Related posts functionality
- [ ] Comment system (optional)
```

### 12. Local SEO (if applicable)

```
Local Presence:
- [ ] Google Business Profile
- [ ] NAP consistency (Name, Address, Phone)
- [ ] Local schema markup
- [ ] Location pages (if multiple)
- [ ] Local keywords targeted
```

## Page-by-Page Audit

### Landing Page
| Element | Status | Issue | Action |
|---------|--------|-------|--------|
| Title Tag | | | |
| Meta Description | | | |
| H1 | | | |
| OG Tags | | | |
| Schema | | | |
| Page Speed | | | |

### Pricing Page
| Element | Status | Issue | Action |
|---------|--------|-------|--------|

### Features Pages
| Element | Status | Issue | Action |
|---------|--------|-------|--------|

### Documentation
| Element | Status | Issue | Action |
|---------|--------|-------|--------|

## Output Format

### Technical SEO Score: [1-10]
### Organic Readiness: [1-10]
### Marketing Support: [1-10]

### Core Web Vitals
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| LCP | | < 2.5s | |
| FID | | < 100ms | |
| CLS | | < 0.1 | |
| PageSpeed | | > 90 | |

### Technical Issues
| Issue | Severity | Pages Affected | Fix |
|-------|----------|----------------|-----|

### Meta Tag Audit
| Page | Title | Description | OG | Schema |
|------|-------|-------------|-----|--------|

### Missing Elements
| Element | Impact | Priority | Effort |
|---------|--------|----------|--------|
| robots.txt | | | |
| sitemap.xml | | | |
| Structured Data | | | |
| OG Images | | | |

### Indexation Status
| Page Type | Total | Indexed | Issues |
|-----------|-------|---------|--------|

### Recommendations
1. **Critical** (Blocking indexation)
2. **High** (Hurting rankings)
3. **Medium** (Optimization)
4. **Low** (Nice to have)

### SEO Implementation Roadmap
| Phase | Scope | Impact |
|-------|-------|--------|
| Technical Foundation | robots, sitemap, speed | Crawlable |
| On-Page | Meta tags, headings, schema | Indexable |
| Content | Blog, docs, features | Rankable |
| Authority | Backlinks, mentions | Competitive |

### Quick Wins
| Action | Effort | Impact |
|--------|--------|--------|
| Add meta descriptions | 1 hour | Medium |
| Fix page speed issues | 2-4 hours | High |
| Add structured data | 2-4 hours | Medium |
| Create sitemap | 1 hour | High |

---

Remember: SEO is a long-term investment. Technical SEO is the foundation - without it, content and links don't matter. Fix technical issues first, then build content.
