#!/bin/bash
# Content Studio - GitHub Project Setup Script
# Run this once: ./scripts/create-content-studio-project.sh

set -e

echo "🚀 Creating Content Studio project..."

# Create the project
PROJECT_URL=$(gh project create --owner @me --title "Content Studio - \$25M Platform" --format json | jq -r '.url')
PROJECT_NUM=$(echo $PROJECT_URL | grep -oE '[0-9]+$')

echo "✅ Project created: $PROJECT_URL"
echo "   Project number: $PROJECT_NUM"

# Get the project ID for GraphQL operations
PROJECT_ID=$(gh project view $PROJECT_NUM --owner @me --format json | jq -r '.id')

echo ""
echo "📋 Adding draft items to project..."

# Phase 1: Foundation (Weeks 1-4)
gh project item-create $PROJECT_NUM --owner @me --title "[Infra] Set up Perplexity API integration" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[DB] Create content database schema (8 tables)" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[UI] Build Content Studio navigation tab" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[UI] Build Research Panel component" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[Feature] Council integration for content briefs" --format json > /dev/null
echo "  ✅ Phase 1: Foundation (5 items)"

# Phase 2: Content Creation (Weeks 5-8)
gh project item-create $PROJECT_NUM --owner @me --title "[UI] Build Article Editor component (TipTap/Lexical)" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[Feature] AI Content Generation flow (Research → Brief → Draft)" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[UI] Build Brand Playbook settings" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[Feature] SEO optimization assistant" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[API] OpenRouter image generation integration (Flux Pro)" --format json > /dev/null
echo "  ✅ Phase 2: Content Creation (5 items)"

# Phase 3: Media & Publishing (Weeks 9-12)
gh project item-create $PROJECT_NUM --owner @me --title "[UI] Build Media Library component" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[Feature] AI Image generation UI with brand presets" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[UI] Build Social Post composer (LinkedIn, X previews)" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[API] n8n webhook integration for publishing" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[Feature] Content calendar view" --format json > /dev/null
echo "  ✅ Phase 3: Media & Publishing (5 items)"

# Phase 4: Automation & Scale (Weeks 13-18)
gh project item-create $PROJECT_NUM --owner @me --title "[Feature] Content templates system" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[Feature] Multi-platform publishing (one-click cross-post)" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[API] Video generation integration (Kling/Runway)" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[Feature] Analytics dashboard" --format json > /dev/null
gh project item-create $PROJECT_NUM --owner @me --title "[Docs] Content Studio user guide" --format json > /dev/null
echo "  ✅ Phase 4: Automation & Scale (5 items)"

echo ""
echo "🎉 Done! 20 items added to your project."
echo ""
echo "📌 Open your project: $PROJECT_URL"
echo ""
echo "Next steps:"
echo "  1. Open the project link above"
echo "  2. Rename columns: Backlog | Ready | In Progress | Review | Done"
echo "  3. Drag items to organize by priority"
